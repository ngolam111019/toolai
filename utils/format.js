// utils/format.js

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
    const d = new Date(nowVN);
    return d.toISOString();
  }

  module.exports = {
    formatCurrency,
    formatNumber,
    formatWithUnit,
    formatDateVN,
    getTodayISO_VN
  };