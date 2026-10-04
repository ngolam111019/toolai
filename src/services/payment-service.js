/**
 * Payment Service — Business Logic Layer
 *
 * Xử lý logic:
 * - Tạo QR payment (VietQR - MB Bank)
 * - Xử lý webhook từ Sepay
 * - Cộng/trừ xu, nâng cấp gói
 */
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const AppError = require('../utils/app-error');
const paymentRepo = require('../repositories/payment-repository');
const db = require('../config/db');
const format = require('../utils/format');
const { sendDiscord } = require('../utils/discord-notify');
const { emitToRoom } = require('./socket-service');
const { pushNoti } = require('../utils/noti');

const MBBANK_ACCOUNT = process.env.MBBANK_ACCOUNT_NO;
const MBBANK_NAME = process.env.MBBANK_ACCOUNT_NAME;
const SEPAY_API_KEY = process.env.SEPAY_API_KEY;
const SEPAY_WEBHOOK_SECRET = process.env.SEPAY_WEBHOOK_SECRET;

const BONUS_THRESHOLD = 2000000;
const BONUS_AMOUNT = 500000;

/**
 * Map package_id -> event code cho event log
 */
const PACKAGE_EVENT_CODES = {
  1: 'ON_UPGRADE_TRIAL_PRO',
  2: 'ON_UPGRADE_PREMIUM',
  3: 'ON_PREMIUM_PRO_INACTIVE',
};

/**
 * Tao ma noi dung chuyen khoan ngan gon (6 ky tu)
 */
function generateTransferCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Tao VietQR URL cho MB Bank
 * @param {number} amount
 * @param {string} content - Noi dung chuyen khoan
 * @returns {string}
 */
function buildVietQRUrl(amount, content) {
  const params = new URLSearchParams({
    amount: amount.toString(),
    addInfo: content,
    accountName: MBBANK_NAME,
  });
  return `https://img.vietqr.io/image/MB-${MBBANK_ACCOUNT}-compact2.png?${params}`;
}

/**
 * Tao payment QR (giao dich nap xu)
 *
 * @param {number} userId
 * @param {number} amount - So tien VND
 * @param {number} packageId
 * @returns {Promise<{tranid, expired_at, qr_url, account_number, account_name, content, bank}>}
 */
async function createPayment(userId, amount, packageId) {
  const tranId = uuidv4();
  const expiredAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phut
  const transferCode = generateTransferCode();
  const content = `UID${userId} ${transferCode}`;

  const qrUrl = buildVietQRUrl(amount, content);

  await paymentRepo.createTransaction(userId, amount, tranId, expiredAt, packageId, transferCode);

  return {
    tranid: tranId,
    expired_at: expiredAt,
    qr_url: qrUrl,
    account_number: MBBANK_ACCOUNT,
    account_name: MBBANK_NAME,
    content,
    bank: 'MB Bank',
  };
}

/**
 * Xac minh API key tu Sepay webhook
 * @param {string} apiKey - API key from header
 * @returns {boolean}
 */
function verifySepayApiKey(apiKey) {
  if (!SEPAY_API_KEY) return true; // Skip in dev if not configured
  return apiKey === SEPAY_API_KEY;
}

/**
 * Xac minh HMAC-SHA256 signature tu Sepay webhook
 * Format: sha256=HMAC-SHA256(timestamp.body, secret)
 * @param {string} signature - x-sepay-signature header
 * @param {string} timestamp - x-sepay-timestamp header
 * @param {string} rawBody - Raw request body
 * @returns {boolean}
 */
function verifySepayHmac(signature, timestamp, rawBody) {
  if (!SEPAY_WEBHOOK_SECRET) return true; // Skip in dev if not configured
  if (!signature || !timestamp) return false;

  // Check timestamp within 5 minutes
  const reqTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - reqTime) > 300) {
    console.log('Webhook timestamp expired:', reqTime, 'now:', now);
    return false;
  }

  // Verify HMAC
  const payload = `${timestamp}.${rawBody}`;
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', SEPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Check length first to avoid timingSafeEqual throwing
  if (signature.length !== expectedSig.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}

/**
 * Parse noi dung chuyen khoan de lay userId va transferCode
 * Format: "UID{userId} {transferCode}"
 * @param {string} content
 * @returns {{userId: number, transferCode: string} | null}
 */
function parseTransferContent(content) {
  if (!content) return null;
  const match = content.toUpperCase().match(/UID(\d+)\s+([A-F0-9]{6})/);
  if (!match) return null;
  return {
    userId: parseInt(match[1], 10),
    transferCode: match[2],
  };
}

/**
 * Xu ly upgrade package trong transaction
 * @param {object} tx - Transaction record
 * @param {object} client - DB client for transaction
 * @returns {Promise<{upgraded: boolean, reason?: string, package?: object}>}
 */
async function processPackageUpgrade(tx, client) {
  const pkg = await paymentRepo.findPackageById(tx.package_id);
  if (!pkg) {
    return { upgraded: false, reason: 'PACKAGE_NOT_FOUND', message: 'Goi khong ton tai' };
  }

  // Package_id = 1 (Trial) co gioi han
  if (tx.package_id === 1) {
    return {
      upgraded: false,
      reason: 'TRIAL_LIMIT',
      message: `Nang cap KHONG thanh cong ${pkg.name} (Da du suat). Vui long chon goi khac.`,
      package: pkg,
    };
  }

  const currentBalance = await paymentRepo.getUserBalance(tx.user_id);
  if (currentBalance < pkg.price) {
    return {
      upgraded: false,
      reason: 'INSUFFICIENT_BALANCE',
      message: `Khong du Xu de nang cap ${pkg.name}. Can ${format.formatWithUnit(pkg.price, 'Xu')}, hien co ${format.formatWithUnit(currentBalance, 'Xu')}.`,
      package: pkg,
    };
  }

  // Thuc hien upgrade trong transaction
  await paymentRepo.debitUserBalance(tx.user_id, pkg.price, client);
  await paymentRepo.insertPurchaseTransaction(tx.user_id, pkg.price, pkg.name, pkg.id, client);
  await paymentRepo.deleteUserPackages(tx.user_id, client);

  const expiredAt = pkg.is_lifetime
    ? '9999-12-31'
    : new Date(Date.now() + pkg.duration_days * 86400 * 1000);

  await paymentRepo.createUserPackage(tx.user_id, pkg.id, expiredAt, client);

  const eventCode = PACKAGE_EVENT_CODES[pkg.id] || 'ON_SIGNUP';
  await paymentRepo.insertUserEventLog(tx.user_id, eventCode, client);

  return {
    upgraded: true,
    message: `Nang cap thanh cong ${pkg.name} (-${format.formatWithUnit(pkg.price, 'Xu')})`,
    package: pkg,
  };
}

/**
 * Xu ly webhook tu Sepay (khi co giao dich moi)
 * Su dung DB transaction de dam bao data integrity
 *
 * @param {object} webhookData - Data tu Sepay webhook
 * @returns {Promise<void>}
 */
async function handleSepayWebhook(webhookData) {
  const { transferAmount, content, transferType } = webhookData;

  // Chi xu ly giao dich IN (nhan tien)
  if (transferType !== 'in') {
    return;
  }

  // Parse noi dung chuyen khoan
  const parsed = parseTransferContent(content);
  if (!parsed) {
    console.log('Khong parse duoc noi dung:', content);
    return;
  }

  const { userId, transferCode } = parsed;
  const actualAmount = parseInt(transferAmount, 10);

  // Tim giao dich pending theo transferCode
  const tx = await paymentRepo.findPendingTransactionByCode(transferCode);
  if (!tx) {
    console.log('Khong tim thay giao dich pending voi code:', transferCode);
    return;
  }

  // Kiem tra userId khop
  if (tx.user_id !== userId) {
    console.log('userId khong khop:', tx.user_id, userId);
    return;
  }

  // Amount verification
  const expectedAmount = tx.amount;
  let amountWarning = null;
  if (actualAmount < expectedAmount) {
    amountWarning = `So tien thuc nhan (${actualAmount}) it hon yeu cau (${expectedAmount})`;
    console.warn('Amount mismatch:', { expected: expectedAmount, actual: actualAmount, transferCode });
  }

  const userNotify = await paymentRepo.getUserForNotification(tx.user_id);
  const bonusAmount = (actualAmount >= BONUS_THRESHOLD) ? BONUS_AMOUNT : 0;

  // Xu ly payment trong transaction
  let upgradeResult = null;

  try {
    await db.withTransaction(async (client) => {
      // Cong xu chinh
      await paymentRepo.creditUserBalance(tx.user_id, actualAmount, client);
      await paymentRepo.markTransactionSuccess(tx.id, actualAmount, client);

      // Cong xu bonus neu co
      if (bonusAmount > 0) {
        await paymentRepo.insertBonusTransaction(tx.user_id, bonusAmount, tx.ref_code, client);
        await paymentRepo.creditUserBalance(tx.user_id, bonusAmount, client);
      }

      // Nang cap goi neu co package_id
      if (tx.package_id && tx.package_id > 0) {
        upgradeResult = await processPackageUpgrade(tx, client);

        // Neu upgrade that bai vi INSUFFICIENT_BALANCE, van cho phep commit
        // (user da duoc cong Xu, chi khong upgrade duoc)
        if (!upgradeResult.upgraded && upgradeResult.reason === 'INSUFFICIENT_BALANCE') {
          // Khong throw, de transaction commit
        }
      }
    });
  } catch (error) {
    console.error('Payment webhook transaction error:', error);

    // Send Discord alert
    sendDiscord('error', null, {
      title: 'Payment Webhook Error',
      description: `TransferCode: ${transferCode}\nUserId: ${userId}\nAmount: ${actualAmount}\nError: ${error.message}`,
      color: 0xFF0000,
    });

    throw error;
  }

  // --- Build response & notifications (outside transaction) ---
  let messageBonus = '';
  if (bonusAmount > 0) {
    messageBonus = `Duoc tang them ${format.formatWithUnit(bonusAmount, 'Xu')} vao tai khoan.`;
  }

  const totalAmount = actualAmount + bonusAmount;
  const title = `Nap ${format.formatWithUnit(actualAmount, 'Xu')} thanh cong.`;

  const resultData = {
    is_success: true,
    tranid: tx.ref_code,
    title,
    message: title + (messageBonus ? ' ' + messageBonus : ''),
    amount: totalAmount,
    confirmed_at: new Date(),
    btnText: 'Xem lich su giao dich',
    screen_redirect: 'history',
    oneClick: false,
  };

  // Them thong tin upgrade vao message
  let discordMeta = {};
  if (upgradeResult) {
    resultData.message += ' ' + upgradeResult.message;
    resultData.oneClick = true;

    if (upgradeResult.package) {
      const { t, d, type } = format.titleDescTypeSenDiscord(
        upgradeResult.upgraded,
        tx.user_id,
        upgradeResult.package.name,
        upgradeResult.package.price,
        userNotify?.platform,
        tx.ref_code
      );
      discordMeta = { title: t, description: d, type };
    }
  }

  // Them warning neu amount khong khop
  if (amountWarning) {
    resultData.message += ` (Luu y: ${amountWarning})`;
  }

  // Gui socket / notification
  const emitted = emitToRoom(tx.ref_code, 'payment_result', resultData);
  if (!emitted) {
    pushNoti(userNotify, {
      title,
      message: `Ma giao dich: ${tx.ref_code}\n${resultData.message}`,
      btnText: 'Xem lich su giao dich',
      screen_redirect: 'history',
    });
  }

  // Discord notification
  if (!discordMeta.type) {
    const { t, d, type } = format.titleDescTypeSenDiscord(false, tx.user_id, null, actualAmount, userNotify?.platform, tx.ref_code);
    discordMeta = { title: t, description: d, type };
  }

  sendDiscord(discordMeta.type, null, {
    title: discordMeta.title,
    description: discordMeta.description,
    color: upgradeResult?.upgraded === false ? 0xFFAA00 : 0x00FF00,
  });
}

module.exports = {
  createPayment,
  handleSepayWebhook,
  verifySepayApiKey,
  verifySepayHmac,
  parseTransferContent,
};
