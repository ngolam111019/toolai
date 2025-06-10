// utils/format.js
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
/**
 * Format số thành tiền tệ Việt Nam, có đơn vị ₫
 * @param {number} amount
 * @returns {string} Ví dụ: "1.499.000 ₫"
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);
  }
  
  /**
   * Format số chỉ hiển thị dấu phân cách hàng nghìn (không có đơn vị)
   * @param {number} amount
   * @returns {string} Ví dụ: "1.499.000"
   */
  function formatNumber(amount) {
    return amount.toLocaleString('vi-VN');
  }
  
  /**
   * Format và gắn đơn vị tùy chọn (xu, VNĐ,...)
   * @param {number} amount
   * @param {string} unit
   * @returns {string} Ví dụ: "1.499.000 xu"
   */
  function formatWithUnit(amount, unit = 'xu') {
    return `${amount.toLocaleString('vi-VN')} ${unit}`;
  }

  function formatDateVN(dateInput) {
    try {
      const date = new Date(dateInput);
      return date.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
      });
    } catch (err) {
      return '---'; // fallback nếu lỗi
    }
  }

  function getTodayISO_VN() {
    const nowVN = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    console.log("nowVN: "+ nowVN);
    return nowVN;
  }

  function getTodayVN() {
    const options = { timeZone: 'Asia/Ho_Chi_Minh' };
    const now = new Date().toLocaleString('en-US', options);
    const date = new Date(now);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months start at 0
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }


  function getTodayVNDatetime() {
    const options = { timeZone: 'Asia/Ho_Chi_Minh' };
    const now = new Date().toLocaleString('en-US', options);
    return new Date(now);
  }


  function convertToVietnamTime(utcDatetime) {
    return dayjs(utcDatetime)
      .tz('Asia/Ho_Chi_Minh')
      .format('DD/MM/YYYY HH:mm');
  }

  module.exports = {
    formatCurrency,
    formatNumber,
    formatWithUnit,
    formatDateVN,
    getTodayISO_VN,
    getTodayVN,
    getTodayVNDatetime
  };