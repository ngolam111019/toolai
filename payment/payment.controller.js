const db = require('../db/db');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');
const { emitToRoom } = require('../socket/socket');
const { v4: uuidv4 } = require('uuid');

// ==============================
// POST /payment/create
// ==============================
const createPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (![200000, 300000, 500000, 1000000, 2000000].includes(amount)) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' });
    }

    const tranid = uuidv4();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000);
    const message = `uid${userId}-${tranid}`;

    // Gửi request đến để tạo QR
    const gbUrl = `https://sv.gamebank.vn/payment/api?` + querystring.stringify({
      username: process.env.GB_USERNAME,
      password: process.env.GB_PASSWORD,
      tran_id: tranid,
      amount,
      bank_code: 'VCB',
      url_code: 0,
      message
    });

    
    /*call api bên thứ 3*/
    /*const gbRes = await axios.get(gbUrl);
    if (gbRes.data?.code != 1) {
      return res.status(500).json({ error: gbRes.data?.message || 'Tạo QR thất bại' });
    }*/
    /*call api bên thứ 3 end*/
    /*giả lâp test*/
    const gbRes = {
      data: {
        code: 1,
        message: 'Success',
        redirectLink: 'data:image/png;base64,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',
        bank: 'Vietcombank',
        bankname: 'Dương Nhật Thành',
        banknumber: '',
        phonenumber: '0877450226',
        content: 'RXWZYM'
      }
    }
    const raw = process.env.GB_USERNAME + process.env.GB_PASSWORD + amount + tranid + '9' + 'success';
    const computedSig = crypto.createHash('sha256').update(raw).digest('hex');
    console.log('signature: ' + computedSig);
    console.log('tranid: ' + tranid);
    /*giả lâp test end*/
    
    // Ghi vào bảng n_transactions
    await db.query(`
      INSERT INTO n_transactions (user_id, amount, type, status, reason, ref_code, expired_at)
      VALUES ($1, $2, 'payment', 'pending', 'Nạp QR', $3, $4)
    `, [userId, amount, tranid, expiredAt]);

    var rs = {
      tranid,
      expired_at: expiredAt,
      qr_url: gbRes.data.redirectLink,
      account_number: gbRes.data.banknumber || gbRes.data.phonenumber,
      account_name: gbRes.data.bankname,
      content: gbRes.data.content,
      bank: gbRes.data.bank
    };
    //console.log(rs);

    return res.json(rs);
  } catch (err) {
    console.error('[createPayment]', err);
    return res.status(500).json({ error: 'Lỗi tạo giao dịch nạp xu' });
  }
}

// ==============================
// GET /payment/callback
// ==============================
const handlePaymentCallback = async (req, res) => {
  try {
    const {
      username, password,
      amount, tran_id,
      errorcode, messages,
      signature
    } = req.query;

    console.log(req.query);
    // Xác minh chữ ký
    const raw = username + password + amount + tran_id + errorcode + messages;
    const computedSig = crypto.createHash('sha256').update(raw).digest('hex');

    if (computedSig !== signature) {
      return res.status(403).json({ code: 0, message: 'Sai chữ ký' });
    }

    if (username !== process.env.GB_USERNAME || password !== process.env.GB_PASSWORD) {
      return res.status(403).json({ code: 0, message: 'Tài khoản không hợp lệ' });
    }

    // Kiểm tra giao dịch tồn tại và còn hạn
    const { rows } = await db.query(`
      SELECT * FROM n_transactions
      WHERE ref_code = $1 AND type = 'payment' AND status = 'pending'
    `, [tran_id]);
    if (!rows.length) return res.status(404).json({ code: 0, message: 'Giao dịch không hợp lệ hoặc đã xử lý' });

    const tx = rows[0];
    
    if (errorcode !== "9") {
      // Nếu là thất bại
      await db.query(`
        UPDATE n_transactions
        SET status = 'failed'
        WHERE id = $1
      `, [tx.id]);
      return res.status(400).json({ code: 0, message: 'Giao dịch thất bại' });
    }
    else{
      const bonusAmount = (amount == 2000000) ? 500000 : 0;
      let messageBonus = "";

      // Cộng Xu vào tài khoản
      await db.query(`UPDATE n_users SET balance_xu = balance_xu + $1 WHERE id = $2`, [amount, tx.user_id]);

      // Cập nhật giao dịch thành công
      await db.query(`
        UPDATE n_transactions
        SET status = 'success',
        amount = $2
        WHERE id = $1
      `, [tx.id, amount]);

      // Nếu có tặng thêm → thêm dòng bonus
      if (bonusAmount > 0) {
        await db.query(`
          INSERT INTO n_transactions (user_id, amount, type, status, reason, ref_code)
          VALUES ($1, $2, 'bonus', 'success', 'Tặng thêm khi nạp 2 triệu', $3)
        `, [tx.user_id, bonusAmount, tx.ref_code]); // ref_code = tranid

        messageBonus = "Được tặng thêm " + bonusAmount + " xu vào tài khoản."
      }
    
    var totalAmount = parseInt(amount) + parseInt(bonusAmount);
    // Gửi socket về client
    emitToRoom(tran_id, 'payment_success', {
      type: 'xu',
      amount: totalAmount,
      tranid: tran_id,
      message: '✅ Nạp ' + amount + ' xu thành công. ' + messageBonus,
      confirmed_at: new Date()
    });
      return res.json({ ok: true });
    }
  } catch (err) {
    console.error('[payment/callback]', err);
    return res.status(500).json({ code: 0, message: 'Lỗi hệ thống callback' });
  }
}

// ==============================
// GET /payment/check?tranid=...
// ==============================
const checkPaymentStatus = async (req, res) => {
  try {
    const { tranid } = req.query;
    if (!tranid) return res.status(400).json({ error: 'Thiếu tranid' });

    const { rows } = await db.query(`SELECT payment_status FROM n_payments WHERE tranid = $1`, [tranid]);
    console.log(tranid);
    console.log(!rows.length);
    if (!rows.length) return res.json({ success: false });

    const status = rows[0].payment_status;
    console.log(status);
    return res.json({ success: status === 'success' });
  } catch (err) {
    console.error('[checkPaymentStatus]', err);
    return res.status(500).json({ success: false });
  }
}

module.exports = {
  createPayment,
  handlePaymentCallback,
  checkPaymentStatus
};