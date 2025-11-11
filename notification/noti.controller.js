const cron = require('node-cron');
const { pushNoti } = require('../utils/noti');
const db = require('../db/db');

const scheduledJobs = new Map();

async function schedule(req, res) {
  try {
    const { id, email } = req.user;
    const userPackagesRows = await db.query(
      `SELECT package_id FROM n_user_packages WHERE user_id = $1`,
      [id]
    );
    const package_id = userPackagesRows.rows[0]?.package_id || 0;

    if (package_id == 0 || package_id == 1) {
      cancelUserJobs(email);
      return res
        .status(500)
        .json({ message: 'User not free, no jobs scheduled.' });
    }

    cancelUserJobs(email);

    const sub = req.user.platform == 1
      ? req.user.web_push_subscription
      : req.user.fcm_token;
    if (!sub)
      return res.status(400).json({ error: 'No push subscription found' });

    const jobs = [
      {
        delay: '0 */12 * * *',
        msg: 'Còn vài giờ nữa để nhận gói Premium giảm 50%!',
        title: 'Ưu đãi sắp hết',
      },
      {
        delay: '0 */24 * * *',
        msg: 'Hôm nay là ngày cuối cùng nhận ưu đãi Premium 1000k!',
        title: 'Cơ hội cuối cùng',
      },
    ];

    jobs.forEach((job) => {
      const task = cron.schedule(job.delay, () => {
        const _data = {
          title: job.title + ' - Tool AI',
          message: job.msg,
          btnText: 'Nâng cấp ngay',
          screen_redirect: 'package',
        };
        pushNoti(req.user, _data);
      });
      scheduledJobs.set(email, task);
    });

    res.json({ message: 'Notifications scheduled.' });
  } catch (err) {
    console.error('[noti.schedule]', err);
    res.status(500).json({ message: 'Lỗi xử lý tool' });
  }
}

async function cancel(req, res) {
  const { email } = req.user;
  cancelUserJobs(email);
  res.json({ message: 'All notifications cancelled.' });
}

async function testNoti(req, res) {
  try {
    const _data = {
      title: 'Bạn có 5 lượt dùng thử miễn phí',
      message:
        'Bạn có 5 lượt dùng thử miễn phí cho cổng game Zon88 trong 24h. Thử ngay để thấy độ chính xác của Tool AI nhé!',
      btnText: 'Nâng cấp ngay',
      screen_redirect: 'package',
    };
    pushNoti(req.user, _data);
    res.status(200).json({ message: 'Test thành công' });
  } catch (err) {
    console.error('[noti.testNoti]', err);
    res.status(500).json({ message: 'Lỗi xử lý tool' });
  }
}

/* 💡 Thêm hàm dùng cho login flow */
async function handleNotificationSchedule(user) {
  try {
    const { id, email } = user;
    const userPackagesRows = await db.query(
      `SELECT package_id FROM n_user_packages WHERE user_id = $1`,
      [id]
    );
    const package_id = userPackagesRows.rows[0]?.package_id || 0;

    // Nếu user đã nâng cấp (Premium / Premium Pro)
    if (package_id != 0 && package_id != 1) {
      cancelUserJobs(email);
      console.log(`[noti] ${email}: đã nâng cấp → hủy các thông báo`);
      return;
    }

    cancelUserJobs(email);

    const sub = user.platform == 1 ? user.web_push_subscription : user.fcm_token;
    if (!sub) return console.log(`[noti] ${email}: chưa có subscription`);

    // const jobs = [
    //   {
    //     delay: '0 */12 * * *',
    //     msg: 'Còn vài giờ nữa để nhận gói Premium giảm 50%!',
    //     title: 'Ưu đãi sắp hết',
    //   },
    //   {
    //     delay: '0 */24 * * *',
    //     msg: 'Hôm nay là ngày cuối cùng nhận ưu đãi Premium 1000k!',
    //     title: 'Cơ hội cuối cùng',
    //   },
    // ];

    const jobs = [
      {
        delay: '*/1 * * * *', // chạy mỗi 1 phút
        msg: 'Còn vài giờ nữa để nhận gói Premium giảm 50%!',
        title: 'Ưu đãi sắp hết',
      },
      {
        delay: '*/3 * * * *', // chạy mỗi 3 phút
        msg: 'Hôm nay là ngày cuối cùng nhận ưu đãi Premium 1000k!',
        title: 'Cơ hội cuối cùng',
      },
    ];

    jobs.forEach((job) => {
      const task = cron.schedule(
        job.delay,
        () => {
          const _data = {
            title: job.title + ' - Tool AI',
            message: job.msg,
            btnText: 'Nâng cấp ngay',
            screen_redirect: 'package',
          };
          pushNoti(user, _data);
        },
        { timezone: 'Asia/Ho_Chi_Minh' }
      );
      scheduledJobs.set(email, task);
    });

    console.log(`[noti] ${email}: schedule ${jobs.length} notification(s)`);
  } catch (err) {
    console.error('[handleNotificationSchedule]', err);
  }
}

function cancelUserJobs(email) {
  const job = scheduledJobs.get(email);
  if (job) job.stop();
  scheduledJobs.delete(email);
}

module.exports = {
  testNoti,
  schedule,
  handleNotificationSchedule,
};