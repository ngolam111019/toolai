
const { pushNoti } = require('../utils/noti');

async function testNoti(req, res) {
  try {
    var _data = {
            title: "Bạn có 5 lượt dùng thử miễn phí", 
            message: "Bạn có 5 lượt dùng thử miễn phí cho cổng game Zon88 trong 24h. Thử ngay để thấy độ chính xác của Tool AI nhé!",
            btnText: "Thử ngay", 
            screen_redirect: "tool"
          };
    pushNoti(req.user, _data);
    res.status(200).json({ message: 'Test thành công' });
  } catch (err) {
    console.error('[useTool]', err);
    res.status(500).json({ message: 'Lỗi xử lý tool' });
  }
}

module.exports = {
  testNoti
};