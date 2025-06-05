const nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({ // config mail server
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendMail (to, subject, htmlContent) {
  const mailOptions = {
    from: `"Tool AI" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
}
async function sendOtpEmail(to, otp) {
  const mailOptions = {
    from: `"Tool AI" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Mã xác thực tài khoản của bạn',
    html: `<p>Chào bạn,</p>
           <p>Mã OTP của bạn là: <strong>${otp}</strong></p>
           <p>Mã có hiệu lực trong 10 phút.</p>`
  };

  return transporter.sendMail(mailOptions);
}


async function sendPasswordEmail(to, pass) {
  const mailOptions = {
    from: `"Tool AI" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Tài khoản Tool AI đã được tạo',
    html: `<p>Chúc mừng bạn đã đăng ký thành công.</p>
           <p>Mật khẩu đăng nhập là: <strong>${pass}</strong></p>`
  };
  
  return transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail, sendMail, sendPasswordEmail };