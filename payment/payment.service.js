const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');
const { emitToRoom } = require('../socket/socket');

async function createXuPayment(userId, amount) {
  const tranid = uuidv4();
  const expired_at = new Date(Date.now() + 5 * 60 * 1000);

  const username = process.env.GB_USERNAME;
  const password = process.env.GB_PASSWORD;
  const message = `uid${userId}-${tranid}`;

  const params = {
    username,
    password,
    tran_id: tranid,
    amount,
    bank_code: 'VCB',
    url_code: 0,
    message
  };

  const gbUrl = `https://sv.gamebank.vn/payment/api?${querystring.stringify(params)}`;
  const gbRes = await axios.get(gbUrl);

  if (!gbRes.data || gbRes.data.code !== '1') {
    throw new Error(`Tạo QR thất bại: ${gbRes.data?.message || 'Không rõ nguyên nhân'}`);
  }

  await db.query(`
    INSERT INTO n_payments (tranid, user_id, amount_paid, payment_status, expired_at, payment_method, payment_type)
    VALUES ($1, $2, $3, 'pending', $4, 'gamebank', 'xu')
  `, [tranid, userId, amount, expired_at]);

  return {
    tranid,
    expired_at,
    qr_url: gbRes.data.redirectLink,
    account_name: gbRes.data.bankname,
    account_number: gbRes.data.banknumber || gbRes.data.phonenumber,
    content: gbRes.data.content
  };
}
async function handlePaymentCallback(req, res) {
  try {
    const {
      username, password,
      amount, tran_id,
      errorcode, messages,
      signature
    } = req.body;

    if (!tran_id || !signature || !amount || !errorcode) {
      return res.status(400).json({ code: 0, message: 'Thiếu tham số' });
    }

    const raw = username + password + amount + tran_id + errorcode + messages;
    const computedSig = crypto.createHash('sha256').update(raw).digest('hex');

    if (computedSig !== signature) {
      return res.status(403).json({ code: 0, message: 'Chữ ký không hợp lệ' });
    }

    if (username !== process.env.GB_USERNAME || password !== process.env.GB_PASSWORD) {
      return res.status(403).json({ code: 0, message: 'Sai tài khoản' });
    }

    if (errorcode === "00") {
      const { rows } = await db.query(`SELECT * FROM n_payments WHERE tranid = $1`, [tran_id]);
      if (!rows.length) return res.status(404).json({ code: 0, message: 'Không tìm thấy giao dịch' });

      const payment = rows[0];
      if (payment.payment_status !== 'pending') return res.json({ code: 1, message: 'Đã xử lý' });

      await db.query(`
        UPDATE n_payments
        SET payment_status = 'success',
            confirmed_at = NOW(),
            third_party_txn = $1,
            callback_data = $2
        WHERE id = $3
      `, [messages || null, req.body, payment.id]);

      await db.query(`
        UPDATE n_users
        SET balance_xu = balance_xu + $1
        WHERE id = $2
      `, [payment.amount_paid, payment.user_id]);

      await db.query(`
        INSERT INTO n_balance_logs (user_id, amount, reason)
        VALUES ($1, $2, $3)
      `, [payment.user_id, payment.amount_paid, 'Nạp xu qua Gamebank']);

      emitToRoom(tran_id, 'payment_success', {
        type: 'xu',
        message: '✅ Nạp xu thành công',
        amount: parseInt(amount),
        confirmed_at: new Date()
      });

      return res.json({ code: 1, message: 'OK' });
    }

    return res.status(400).json({ code: 0, message: 'Giao dịch thất bại', errorcode });
  } catch (err) {
    console.error('[payment/callback]', err);
    return res.status(500).json({ code: 0, message: 'Lỗi hệ thống' });
  }
}

module.exports = {
  createXuPayment,
  handlePaymentCallback
};