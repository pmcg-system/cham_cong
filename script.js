/**
 * CẤU HÌNH GOOGLE APPS SCRIPT
 * Dán URL của Web App sau khi Deploy trên Google Apps Script vào biến dưới đây.
 */
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxNQXg2uLWsAt8LgUdaCTlMRR_1vRrCdCAJl-bUOCNvuU7MzM2CqnXt1kncjhamE2V4Sw/exec';

// Trạng thái ứng dụng
let currentMonthYear = '';
let employees = JSON.parse(localStorage.getItem('med_employees')) || [
  'Nguyễn Văn A',
  'Trần Thị B',
  'Lê Văn C'
];
let chamCongData = {}; // { "Nguyễn Văn A": { "1": "sang", "2": "ca-ngay", ... } }
let thuThuatData = {}; // { "Nguyễn Văn A": { loai1: 0, loai2: 0, loai3: 0 } }

let saveTimeout = null;

// Khởi tạo
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initMonthYearPicker();
  renderEmployeesTable();
  initEmployeeManager();
  initExcelUploader();
  initExportExcel();
  initModal();
  initEditModal();
});

// --- UI & TAB QUẢN LÝ ---
function initTabs() {
  const links = document.querySelectorAll('.nav-links li');
  const panes = document.querySelectorAll('.tab-pane');

  links.forEach(link => {
    link.addEventListener('click', () => {
      // Bỏ active links
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Ẩn tất cả panes
      panes.forEach(p => p.classList.remove('active'));

      // Hiện pane được chọn
      const tabId = link.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');

      // Đổi title
      document.getElementById('page-title').innerText = link.querySelector('span').innerText;

      if (tabId === 'tab-thongke') {
        renderThongKeTable();
      }
    });
  });
}

function initMonthYearPicker() {
  const picker = document.getElementById('month-year-picker');
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  currentMonthYear = `${year}-${month}`;
  picker.value = currentMonthYear;

  fetchDataFromServer(); // Fetch dữ liệu lần đầu

  picker.addEventListener('change', (e) => {
    currentMonthYear = e.target.value;
    fetchDataFromServer();
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  if (show) overlay.classList.remove('hidden');
  else overlay.classList.add('hidden');
}

function updateSyncStatus(status) {
  const el = document.getElementById('sync-status');
  el.className = 'status-indicator';

  if (status === 'saving') {
    el.classList.add('saving');
    el.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Đang lưu...";
  } else if (status === 'error') {
    el.classList.add('error');
    el.innerHTML = "<i class='bx bx-error'></i> Lỗi đồng bộ";
  } else {
    el.innerHTML = "<i class='bx bx-check-circle'></i> Đã đồng bộ";
  }
}

// --- QUẢN LÝ NHÂN VIÊN ---
function initEmployeeManager() {
  const btnAdd = document.getElementById('btn-add-employee');
  const input = document.getElementById('new-employee-name');

  btnAdd.addEventListener('click', () => {
    const name = input.value.trim();
    if (name && !employees.includes(name)) {
      employees.push(name);
      saveEmployeesLocally();
      renderEmployeesTable();
      renderChamCongTable(); // Cập nhật lại bảng chấm công
      input.value = '';
    }
  });

  // Cho phép bấm Enter để thêm
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      btnAdd.click();
    }
  });
}

function saveEmployeesLocally() {
  localStorage.setItem('med_employees', JSON.stringify(employees));
}

let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  document.getElementById('confirm-title').innerText = title;
  document.getElementById('confirm-message').innerText = message;
  confirmCallback = onConfirm;
  document.getElementById('confirm-modal').classList.add('show');
}

function initModal() {
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.remove('show');
  });
  
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.remove('show');
    if (confirmCallback) confirmCallback();
  });
}

function removeEmployee(index) {
  showConfirm('Xác nhận xóa', `Bạn có chắc chắn muốn xóa nhân viên "${employees[index]}"?`, () => {
    employees.splice(index, 1);
    saveEmployeesLocally();
    renderEmployeesTable();
    renderChamCongTable();
  });
}

let editIndex = -1;

function editEmployee(index) {
  editIndex = index;
  document.getElementById('edit-employee-name').value = employees[index];
  document.getElementById('edit-modal').classList.add('show');
  setTimeout(() => document.getElementById('edit-employee-name').focus(), 100);
}

function initEditModal() {
  const modal = document.getElementById('edit-modal');
  const input = document.getElementById('edit-employee-name');
  
  document.getElementById('btn-edit-cancel').addEventListener('click', () => {
    modal.classList.remove('show');
  });
  
  document.getElementById('btn-edit-save').addEventListener('click', () => {
    saveEdit();
  });
  
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveEdit();
  });
  
  function saveEdit() {
    const newName = input.value.trim();
    if (!newName) {
      alert("Tên không được để trống!");
      return;
    }
    
    if (newName === employees[editIndex]) {
      modal.classList.remove('show');
      return;
    }
    
    if (employees.includes(newName)) {
      alert("Tên nhân viên đã tồn tại!");
      return;
    }
    
    const oldName = employees[editIndex];
    employees[editIndex] = newName;
    
    // Migrate data
    if (chamCongData[oldName]) {
      chamCongData[newName] = chamCongData[oldName];
      delete chamCongData[oldName];
      triggerAutoSaveChamCong();
    }
    
    if (thuThuatData[oldName]) {
      thuThuatData[newName] = thuThuatData[oldName];
      delete thuThuatData[oldName];
      saveThuThuatToServer();
    }
    
    saveEmployeesLocally();
    renderEmployeesTable();
    renderChamCongTable();
    
    modal.classList.remove('show');
  }
}

function renderEmployeesTable() {
  const tbody = document.getElementById('nhanvien-body');
  tbody.innerHTML = '';
  employees.forEach((emp, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${emp}</strong></td>
      <td style="display: flex; gap: 8px;">
        <button class="btn btn-primary" style="padding: 6px 12px;" onclick="editEmployee(${index})">
          <i class='bx bx-edit'></i> Sửa
        </button>
        <button class="btn btn-danger" onclick="removeEmployee(${index})">
          <i class='bx bx-trash'></i> Xóa
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- BẢNG CHẤM CÔNG ---
function renderChamCongTable() {
  if (!currentMonthYear) return;
  const [year, month] = currentMonthYear.split('-');
  const daysInMonth = new Date(year, month, 0).getDate();

  const header = document.getElementById('chamcong-header');
  const tbody = document.getElementById('chamcong-body');

  // Header
  let headerHtml = `<th>Tên Nhân Viên</th>`;
  for (let d = 1; d <= daysInMonth; d++) {
    headerHtml += `<th>Ngày ${d}</th>`;
  }
  headerHtml += `<th>Tổng Công</th>`;
  header.innerHTML = headerHtml;

  // Body
  tbody.innerHTML = '';
  employees.forEach(emp => {
    if (!chamCongData[emp]) chamCongData[emp] = {};

    const tr = document.createElement('tr');
    let rowHtml = `<td><strong>${emp}</strong></td>`;

    let tongCong = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const val = chamCongData[emp][d] || '';
      let colorClass = '';
      if (val === 'sang') { colorClass = 'val-sang'; tongCong += 0.5; }
      else if (val === 'chieu') { colorClass = 'val-chieu'; tongCong += 0.5; }
      else if (val === 'ca-ngay') { colorClass = 'val-ca-ngay'; tongCong += 1; }

      rowHtml += `
        <td>
          <select class="cell-select ${colorClass}" data-emp="${emp}" data-day="${d}">
            <option value="">-</option>
            <option value="sang" ${val === 'sang' ? 'selected' : ''}>Sáng</option>
            <option value="chieu" ${val === 'chieu' ? 'selected' : ''}>Chiều</option>
            <option value="ca-ngay" ${val === 'ca-ngay' ? 'selected' : ''}>Cả ngày</option>
          </select>
        </td>
      `;
    }
    rowHtml += `<td class="tong-cong-cell" data-emp-total="${emp}"><strong>${tongCong}</strong></td>`;
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });

  // Gán sự kiện thay đổi
  document.querySelectorAll('.cell-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const emp = e.target.getAttribute('data-emp');
      const day = e.target.getAttribute('data-day');
      const val = e.target.value;

      // Cập nhật màu select
      e.target.className = 'cell-select';
      if (val) e.target.classList.add(`val-${val}`);

      // Lưu vào state
      chamCongData[emp][day] = val;

      // Tính lại tổng công cho row đó
      recalculateRowTotal(emp, daysInMonth);

      // Auto save lên GAS qua debounce
      triggerAutoSaveChamCong();
    });
  });
}

function recalculateRowTotal(emp, daysInMonth) {
  let tong = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const val = chamCongData[emp][d];
    if (val === 'sang' || val === 'chieu') tong += 0.5;
    else if (val === 'ca-ngay') tong += 1;
  }
  document.querySelector(`.tong-cong-cell[data-emp-total="${emp}"]`).innerHTML = `<strong>${tong}</strong>`;
}

// --- XỬ LÝ FILE EXCEL THỦ THUẬT ---
function initExcelUploader() {
  const fileInput = document.getElementById('excel-file-input');
  const btnSubmit = document.getElementById('btn-submit-thuthuat');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const dataRows = XLSX.utils.sheet_to_json(worksheet, { header: "A", defval: "", blankrows: true });

      processExcelData(dataRows);
    };
    reader.readAsArrayBuffer(file);
  });

  btnSubmit.addEventListener('click', () => {
    saveThuThuatToServer();
  });
}

function processExcelData(dataRows) {
  thuThuatData = {}; // Reset data mới

  // Duyệt qua toàn bộ các dòng, an toàn 100%
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row) continue;

    // Đọc đích danh từ cột AN và AT
    const loaiTT = row['AN'];
    let empName = row['AT'];

    if (!empName) continue;
    empName = String(empName).trim();
    if (!empName) continue;
    
    // Bỏ qua dòng tiêu đề nếu vô tình bị lẫn vào
    if (empName.toLowerCase().includes('thủ thuật viên') || empName.toLowerCase().includes('tên nhân viên')) continue;

    if (!thuThuatData[empName]) {
      thuThuatData[empName] = { loai1: 0, loai2: 0, loai3: 0, khac: 0 };
    }

    if (loaiTT) {
      const strLoai = String(loaiTT).toLowerCase();
      if (strLoai.includes('loại 1')) {
        thuThuatData[empName].loai1++;
      } else if (strLoai.includes('loại 2')) {
        thuThuatData[empName].loai2++;
      } else if (strLoai.includes('loại 3')) {
        thuThuatData[empName].loai3++;
      } else {
        thuThuatData[empName].khac++;
      }
    }
  }

  // Tự động thêm nhân viên vào danh sách nếu chưa có
  Object.keys(thuThuatData).forEach(empName => {
    if (!employees.includes(empName)) {
      employees.push(empName);
      saveEmployeesLocally();
    }
  });

  // Render preview
  const tbody = document.getElementById('preview-thuthuat-body');
  tbody.innerHTML = '';

  for (const [emp, stats] of Object.entries(thuThuatData)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${emp}</strong></td>
      <td>${stats.loai1 || 0}</td>
      <td>${stats.loai2 || 0}</td>
      <td>${stats.loai3 || 0}</td>
      <td>${stats.khac || 0}</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('preview-section').classList.remove('hidden');
  renderEmployeesTable(); // Cập nhật lại UI ds nhân viên
  renderChamCongTable(); // Cập nhật bảng chấm công
}

// --- THỐNG KÊ TỔNG HỢP ---
function renderThongKeTable() {
  const tbody = document.getElementById('thongke-body');
  tbody.innerHTML = '';

  employees.forEach(emp => {
    // Tính tổng công
    let tongCong = 0;
    if (chamCongData[emp]) {
      Object.values(chamCongData[emp]).forEach(val => {
        if (val === 'sang' || val === 'chieu') tongCong += 0.5;
        else if (val === 'ca-ngay') tongCong += 1;
      });
    }

    // Lấy thủ thuật
    const stats = thuThuatData[emp] || { loai1: 0, loai2: 0, loai3: 0, khac: 0 };

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${emp}</strong></td>
      <td style="color: var(--primary-color); font-weight: bold;">${tongCong}</td>
      <td>${stats.loai1 || 0}</td>
      <td>${stats.loai2 || 0}</td>
      <td>${stats.loai3 || 0}</td>
      <td>${stats.khac || 0}</td>
    `;
    tbody.appendChild(tr);
  });
}

function initExportExcel() {
  document.getElementById('btn-export-excel').addEventListener('click', () => {
    const table = document.getElementById('table-thongke');
    const wb = XLSX.utils.table_to_book(table, { sheet: "Thống Kê" });
    XLSX.writeFile(wb, `ThongKe_${currentMonthYear}.xlsx`);
  });
}


// --- KẾT NỐI API VỚI GOOGLE APPS SCRIPT ---

function fetchDataFromServer() {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes('ĐIỀN_URL_WEB_APP')) {
    console.warn("Chưa cấu hình GAS_WEBAPP_URL");
    renderChamCongTable(); // Render rỗng cục bộ
    return;
  }

  showLoading(true);

  fetch(`${GAS_WEBAPP_URL}?action=getAllData&monthYear=${currentMonthYear}`, {
    method: 'GET',
    redirect: 'follow' // Quan trọng cho Google Apps Script
  })
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success') {
        chamCongData = res.data.chamcong || {};
        thuThuatData = res.data.thuthuat || {};

        // Auto thêm nhân viên từ data cũ nếu chưa có trong LocalStorage
        Object.keys(chamCongData).forEach(emp => {
          if (!employees.includes(emp)) employees.push(emp);
        });
        Object.keys(thuThuatData).forEach(emp => {
          if (!employees.includes(emp)) employees.push(emp);
        });
        saveEmployeesLocally();

        renderEmployeesTable();
        renderChamCongTable();

        // Render data preview thủ thuật (nếu có)
        const tbody = document.getElementById('preview-thuthuat-body');
        if (Object.keys(thuThuatData).length > 0) {
          tbody.innerHTML = '';
          for (const [emp, stats] of Object.entries(thuThuatData)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td><strong>${emp}</strong></td>
            <td>${stats.loai1}</td>
            <td>${stats.loai2}</td>
            <td>${stats.loai3}</td>
          `;
            tbody.appendChild(tr);
          }
          document.getElementById('preview-section').classList.remove('hidden');
        } else {
          document.getElementById('preview-section').classList.add('hidden');
        }

        showToast(`Đã tải dữ liệu tháng ${currentMonthYear}`);
      }
    })
    .catch(err => {
      console.error("Fetch Error:", err);
      showToast("Lỗi khi tải dữ liệu từ máy chủ");
    })
    .finally(() => {
      showLoading(false);
    });
}

function triggerAutoSaveChamCong() {
  updateSyncStatus('saving');
  clearTimeout(saveTimeout);

  // Đợi 2 giây sau lần gõ cuối mới lưu để tránh spam request
  saveTimeout = setTimeout(() => {
    saveChamCongToServer();
  }, 2000);
}

function saveChamCongToServer() {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes('ĐIỀN_URL_WEB_APP')) {
    updateSyncStatus('error');
    return;
  }

  fetch(GAS_WEBAPP_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'saveChamCong',
      monthYear: currentMonthYear,
      data: chamCongData
    })
  })
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success') {
        updateSyncStatus('success');
      } else {
        updateSyncStatus('error');
      }
    })
    .catch(err => {
      console.error("Save Error:", err);
      updateSyncStatus('error');
    });
}

function saveThuThuatToServer() {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes('ĐIỀN_URL_WEB_APP')) {
    alert("Vui lòng cấu hình URL Web App trong script.js trước khi gửi.");
    return;
  }

  showLoading(true);

  fetch(GAS_WEBAPP_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'saveThuThuat',
      monthYear: currentMonthYear,
      data: thuThuatData
    })
  })
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success') {
        showToast("Đã lưu dữ liệu thủ thuật thành công!");
      } else {
        alert("Lỗi khi lưu: " + res.message);
      }
    })
    .catch(err => {
      console.error("Save Error:", err);
      alert("Lỗi kết nối máy chủ");
    })
    .finally(() => {
      showLoading(false);
    });
}
