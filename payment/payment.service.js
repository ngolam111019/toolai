/**
 * Payment Service — Business Logic Layer
 *
 * Xử lý logic:
 * - Tạo QR payment
 * - Xử lý callback từ payment gateway
 * - Xác minh chữ ký
 * - Cộng/trừ xu, nâng cấp gói
 */
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const { v4: uuidv4 } = require('uuid');

const AppError = require('../src/utils/app-error');
const paymentRepo = require('./payment.repository');
const format = require('../utils/format');
const { sendDiscord } = require('../utils/discordNotify');
const { emitToRoom } = require('../socket/socket');
const { pushNoti } = require('../utils/noti');

const BONUS_THRESHOLD = 2000000;
const BONUS_AMOUNT = 500000;

/**
 * Map package_id → event code cho event log
 */
const PACKAGE_EVENT_CODES = {
  1: 'ON_UPGRADE_TRIAL_PRO',
  2: 'ON_UPGRADE_PREMIUM',
  3: 'ON_PREMIUM_PRO_INACTIVE',
};

/**
 * Tạo payment QR (giao dịch nạp xu)
 *
 * @param {number} userId
 * @param {number} amount - Số tiền VND
 * @param {number} packageId
 * @returns {Promise<{tranid, expired_at, qr_url, account_number, account_name, content, bank}>}
 */
async function createPayment(userId, amount, packageId) {
  const tranId = uuidv4();
  const expiredAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút
  const message = `uid${userId}-${tranId}`;

  let paymentData;

  if (process.env.IS_PAYMENT_API_DEMO == 1) {
    // Mode demo — trả dữ liệu giả lập
    paymentData = {
      redirectLink: 'data:image/png;base64,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',
      bank: 'Vietcombank',
      bankname: 'Dương Nhật Thành',
      banknumber: '',
      phonenumber: '0877450226',
      content: 'RXWZYM',
    };
  } else {
    // Mode thật — gọi GameBank API
    const gbUrl = `https://sv.gamebank.vn/payment/api?` + querystring.stringify({
      username: process.env.GB_USERNAME,
      password: process.env.GB_PASSWORD,
      tran_id: tranId,
      amount,
      bank_code: 'MSB',
      url_code: 448,
      message,
    });

    const gbRes = await axios.get(gbUrl);
    if (gbRes.data?.code != 1) {
      throw new AppError(gbRes.data?.message || 'Tạo QR thất bại', 500, 'PAYMENT_QR_FAILED');
    }
    paymentData = gbRes.data;
  }

  await paymentRepo.createTransaction(userId, amount, tranId, expiredAt, packageId);

  return {
    tranid: tranId,
    expired_at: expiredAt,
    qr_url: paymentData.redirectLink,
    account_number: paymentData.banknumber || paymentData.phonenumber,
    account_name: paymentData.bankname,
    content: paymentData.content,
    bank: paymentData.bank,
  };
}

/**
 * Xác minh chữ ký từ payment gateway callback
 * @param {object} queryParams - req.query
 * @returns {boolean}
 */
function verifyCallbackSignature({ username, password, amount, tran_id, errorcode, messages, signature }) {
  const raw = username + password + amount + tran_id + errorcode + messages;
  const computedSig = crypto.createHash('sha256').update(raw).digest('hex');
  return computedSig === signature;
}

/**
 * Xử lý callback payment (thành công hoặc thất bại)
 *
 * @param {object} callbackParams - req.query từ payment gateway
 * @returns {Promise<void>}
 */
async function handlePaymentCallback(callbackParams) {
  const { username, password, amount, tran_id, errorcode, messages, signature } = callbackParams;

  // Xác minh chữ ký
  if (!verifyCallbackSignature(callbackParams)) {
    throw new AppError('Sai chữ ký', 403, 'INVALID_SIGNATURE');
  }

  // Xác minh credentials
  if (username !== process.env.GB_USERNAME || password !== process.env.GB_PASSWORD) {
    throw new AppError('Tài khoản không hợp lệ', 403, 'INVALID_CREDENTIALS');
  }

  // Tìm giao dịch pending
  const tx = await paymentRepo.findPendingTransaction(tran_id);
  if (!tx) {
    throw new AppError('Giao dịch không hợp lệ hoặc đã xử lý', 404, 'TRANSACTION_NOT_FOUND');
  }

  const userNotify = await paymentRepo.getUserForNotification(tx.user_id);

  // ─── Payment FAILED ────────────────────────────────────────
  if (errorcode !== '9') {
    await paymentRepo.markTransactionFailed(tx.id);

    const title = `❌ Nạp ${format.formatWithUnit(amount, 'Xu')} thất bại. `;
    const message = title + `\n Trạng thái: ${messages}`;
    const resultData = { is_success: false, amount, tranid: tran_id, message, confirmed_at: new Date() };

    const emitted = emitToRoom(tran_id, 'payment_result', resultData);
    if (!emitted) {
      pushNoti(userNotify, { title, message: `Mã giao dịch: ${tran_id}\n ${message}`, btnText: 'Xem lịch sử giao dịch', screen_redirect: 'history' });
    }

    throw new AppError(messages, 400, 'PAYMENT_FAILED');
  }

  // ─── Payment SUCCESS ───────────────────────────────────────
  const bonusAmount = (amount == BONUS_THRESHOLD) ? BONUS_AMOUNT : 0;
  let messageBonus = '';

  // Cộng xu chính
  await paymentRepo.creditUserBalance(tx.user_id, amount);
  await paymentRepo.markTransactionSuccess(tx.id, amount);

  // Cộng xu bonus nếu có
  if (bonusAmount > 0) {
    await paymentRepo.insertBonusTransaction(tx.user_id, bonusAmount, tx.ref_code);
    await paymentRepo.creditUserBalance(tx.user_id, bonusAmount);
    messageBonus = `Được tặng thêm ${format.formatWithUnit(bonusAmount, 'Xu')} vào tài khoản.`;
  }

  const totalAmount = parseInt(amount) + parseInt(bonusAmount);
  const title = `✅ Nạp ${format.formatWithUnit(parseInt(amount), 'Xu')} thành công. `;

  const resultData = {
    is_success: true,
    tranid: tran_id,
    title,
    message: title + messageBonus,
    amount: totalAmount,
    confirmed_at: new Date(),
    btnText: 'Xem lịch sử giao dịch',
    screen_redirect: 'history',
    oneClick: false,
  };

  // Nâng cấp gói nếu có package_id
  let discordMeta = {};
  if (tx.package_id && tx.package_id > 0) {
    const pkg = await paymentRepo.findPackageById(tx.package_id);
    if (!pkg) throw new AppError('Gói không tồn tại', 400, 'PACKAGE_NOT_FOUND');

    // Gói slot 1 đã đầy (chỉ 1 slot, dùng cho trial upgrade?)
    if (tx.package_id === 1) {
      resultData.message += `\n❌ Nâng cấp KHÔNG thành công ${pkg.name} (Đã đủ suất). Vui lòng chọn gói khác.`;
      resultData.oneClick = true;
    } else {
      const currentBalance = await paymentRepo.getUserBalance(tx.user_id);
      if (currentBalance < pkg.price) {
        throw new AppError('Không đủ Xu để nâng cấp', 400, 'INSUFFICIENT_BALANCE');
      }

      // Trừ xu, ghi log, xóa gói cũ, tạo gói mới
      await paymentRepo.debitUserBalance(tx.user_id, pkg.price);
      await paymentRepo.insertPurchaseTransaction(tx.user_id, pkg.price, pkg.name, pkg.id);
      await paymentRepo.deleteUserPackages(tx.user_id);

      const expiredAt = pkg.is_lifetime
        ? '9999-12-31'
        : new Date(Date.now() + pkg.duration_days * 86400 * 1000);

      await paymentRepo.createUserPackage(tx.user_id, pkg.id, expiredAt);

      const eventCode = PACKAGE_EVENT_CODES[pkg.id] || 'ON_SIGNUP';
      await paymentRepo.insertUserEventLog(tx.user_id, eventCode);

      resultData.message += `\n📦 Nâng cấp thành công ${pkg.name} (-${format.formatWithUnit(pkg.price, 'Xu')})`;
      resultData.oneClick = true;
    }

    const { t, d, type } = format.titleDescTypeSenDiscord(true, tx.user_id, pkg.name, pkg.price, userNotify?.platform, tran_id);
    discordMeta = { title: t, description: d, type };
  }

  // Gửi socket / notification
  const emitted = emitToRoom(tran_id, 'payment_result', resultData);
  if (!emitted) {
    pushNoti(userNotify, {
      title,
      message: `Mã giao dịch: ${tran_id}\n ${resultData.message}`,
      btnText: 'Xem lịch sử giao dịch',
      screen_redirect: 'history',
    });
  }

  if (!resultData.oneClick) {
    const { t, d, type } = format.titleDescTypeSenDiscord(false, tx.user_id, null, amount, userNotify?.platform, tran_id);
    discordMeta = { title: t, description: d, type };
  }

  sendDiscord(discordMeta.type, null, {
    title: discordMeta.title,
    description: discordMeta.description,
    color: 0x00FF00,
  });
}

module.exports = {
  createPayment,
  handlePaymentCallback,
};
