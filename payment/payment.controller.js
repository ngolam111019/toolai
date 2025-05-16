const db = require('../db/db');

exports.paymentCallback = async (req, res) => {
  const {
    user_id,
    package_id,
    amount_paid,
    payment_status,
    is_part_of_multi_payment,
    multi_payment_id
  } = req.body;

  try {
    // Ghi log vào bảng payments
    const payRes = await db.query(`
      INSERT INTO n_payments 
        (user_id, package_id, amount_paid, payment_status, is_part_of_multi_payment, multi_payment_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `, [user_id, package_id, amount_paid, payment_status, is_part_of_multi_payment, multi_payment_id]);

    // Nếu thanh toán thất bại → dừng tại đây
    if (payment_status !== 'success') return res.json({ message: 'Payment logged. Not successful.' });

    if (is_part_of_multi_payment && multi_payment_id) {
      // Update multi-payment order
      await db.query(`
        UPDATE n_multi_payment_orders 
        SET total_paid = total_paid + $1
        WHERE id = $2
      `, [amount_paid, multi_payment_id]);

      // Kiểm tra đủ tiền chưa
      const orderRes = await db.query(`SELECT * FROM n_multi_payment_orders WHERE id = $1`, [multi_payment_id]);
      const order = orderRes.rows[0];

      if (order.total_paid >= order.total_required) {
        // Đánh dấu hoàn tất
        await db.query(`
          UPDATE n_multi_payment_orders SET is_completed = TRUE, completed_at = NOW() WHERE id = $1
        `, [multi_payment_id]);

        // Ghi vào user_packages
        await activatePackage(user_id, order.target_package_id);
      }

      return res.json({ message: 'Part payment received.' });
    }

    // Trường hợp thanh toán gói đơn (gói 1 hoặc 2)
    await activatePackage(user_id, package_id);

    res.json({ message: 'Payment successful & package upgraded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Callback failed' });
  }
};
async function activatePackage(user_id, package_id) {
    // Xóa gói cũ (nếu cần logic chỉ giữ 1 gói active)
    await db.query(`DELETE FROM n_user_packages WHERE user_id = $1`, [user_id]);
  
    // Lấy thời hạn gói mới
    const pkgRes = await db.query(`SELECT * FROM n_packages WHERE id = $1`, [package_id]);
    const pkg = pkgRes.rows[0];
    const now = new Date();
    const expiredAt = pkg.is_lifetime
      ? null
      : new Date(now.getTime() + pkg.duration_days * 24 * 60 * 60 * 1000);
  
    // Tạo bản ghi mới
    await db.query(`
      INSERT INTO n_user_packages
        (user_id, package_id, activated_at, expired_at, turns_used_today, last_turn_reset)
      VALUES
        ($1, $2, NOW(), $3, 0, CURRENT_DATE)
    `, [user_id, package_id, expiredAt]);
  }
