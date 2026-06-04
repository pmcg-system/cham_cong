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
  initErrorChecker();
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
        <td class="text-center">
          <select class="cell-select ${colorClass}" data-emp="${emp}" data-day="${d}">
            <option value="">-</option>
            <option value="sang" ${val === 'sang' ? 'selected' : ''}>Sáng</option>
            <option value="chieu" ${val === 'chieu' ? 'selected' : ''}>Chiều</option>
            <option value="ca-ngay" ${val === 'ca-ngay' ? 'selected' : ''}>Cả ngày</option>
          </select>
        </td>
      `;
    }
    rowHtml += `<td class="tong-cong-cell text-center" data-emp-total="${emp}"><strong>${tongCong}</strong></td>`;
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

  // Khởi tạo sẵn tất cả nhân viên với số 0 để bảng luôn hiển thị đủ người
  employees.forEach(emp => {
    thuThuatData[emp] = { loai1: 0, loai2: 0, loai3: 0, khac: 0 };
  });

  // Duyệt qua toàn bộ các dòng, an toàn 100%
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row) continue;

    // Đọc đích danh từ cột AN và AT
    const loaiTT = row['AN'];
    let rawEmpName = row['AT'];

    if (!rawEmpName) continue;
    rawEmpName = String(rawEmpName).trim();
    if (!rawEmpName) continue;
    
    // Chuẩn hóa Unicode NFC để tránh lỗi font chữ tiếng Việt (tổ hợp vs dựng sẵn)
    const rawEmpNameNormalized = rawEmpName.normalize('NFC').toLowerCase();

    // Bỏ qua dòng tiêu đề
    if (rawEmpNameNormalized.includes('thủ thuật viên') || rawEmpNameNormalized.includes('tên nhân viên')) continue;

    // Tìm nhân viên trong danh sách (không phân biệt hoa thường)
    const matchedEmp = employees.find(e => e.normalize('NFC').toLowerCase() === rawEmpNameNormalized);
    
    // CHỈ lấy nhân viên ĐÃ CÓ trong danh sách quản lý
    if (!matchedEmp) continue;

    // Sử dụng tên chuẩn từ danh sách (matchedEmp)
    if (loaiTT) {
      const strLoai = String(loaiTT).normalize('NFC').toLowerCase();
      if (strLoai.includes('loại 1')) {
        thuThuatData[matchedEmp].loai1++;
      } else if (strLoai.includes('loại 2')) {
        thuThuatData[matchedEmp].loai2++;
      } else if (strLoai.includes('loại 3')) {
        thuThuatData[matchedEmp].loai3++;
      } else {
        thuThuatData[matchedEmp].khac++;
      }
    }
  }

  // Render preview
  const tbody = document.getElementById('preview-thuthuat-body');
  tbody.innerHTML = '';

  let tongL1 = 0, tongL2 = 0, tongL3 = 0, tongKhac = 0, tongTatCa = 0;

  for (const [emp, stats] of Object.entries(thuThuatData)) {
    const l1 = stats.loai1 || 0;
    const l2 = stats.loai2 || 0;
    const l3 = stats.loai3 || 0;
    const khac = stats.khac || 0;
    const total = l1 + l2 + l3 + khac;

    tongL1 += l1; tongL2 += l2; tongL3 += l3; tongKhac += khac; tongTatCa += total;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${emp}</strong></td>
      <td class="text-center">${l1}</td>
      <td class="text-center">${l2}</td>
      <td class="text-center">${l3}</td>
      <td class="text-center">${khac}</td>
      <td class="text-center" style="color: var(--primary-color); font-weight: bold;">${total}</td>
    `;
    tbody.appendChild(tr);
  }

  // Row tổng
  const trTotal = document.createElement('tr');
  trTotal.style.backgroundColor = '#f8f9fc';
  trTotal.innerHTML = `
    <td><strong>TỔNG CỘNG</strong></td>
    <td class="text-center"><strong>${tongL1}</strong></td>
    <td class="text-center"><strong>${tongL2}</strong></td>
    <td class="text-center"><strong>${tongL3}</strong></td>
    <td class="text-center"><strong>${tongKhac}</strong></td>
    <td class="text-center" style="color: var(--primary-color); font-weight: bold;">${tongTatCa}</td>
  `;
  tbody.appendChild(trTotal);

  document.getElementById('preview-section').classList.remove('hidden');
  renderEmployeesTable(); // Cập nhật lại UI ds nhân viên
  renderChamCongTable(); // Cập nhật bảng chấm công
}

// --- THỐNG KÊ TỔNG HỢP ---
function renderThongKeTable() {
  const tbody = document.getElementById('thongke-body');
  tbody.innerHTML = '';

  let tongCongThang = 0;
  let tongL1 = 0, tongL2 = 0, tongL3 = 0, tongKhac = 0, tongTatCa = 0;

  employees.forEach(emp => {
    // Tính tổng công
    let tongCong = 0;
    if (chamCongData[emp]) {
      Object.values(chamCongData[emp]).forEach(val => {
        if (val === 'sang' || val === 'chieu') tongCong += 0.5;
        else if (val === 'ca-ngay') tongCong += 1;
      });
    }
    tongCongThang += tongCong;

    // Lấy thủ thuật
    const stats = thuThuatData[emp] || { loai1: 0, loai2: 0, loai3: 0, khac: 0 };
    const l1 = stats.loai1 || 0;
    const l2 = stats.loai2 || 0;
    const l3 = stats.loai3 || 0;
    const khac = stats.khac || 0;
    const total = l1 + l2 + l3 + khac;

    tongL1 += l1; tongL2 += l2; tongL3 += l3; tongKhac += khac; tongTatCa += total;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${emp}</strong></td>
      <td class="text-center" style="color: var(--primary-color); font-weight: bold;">${tongCong}</td>
      <td class="text-center">${l1}</td>
      <td class="text-center">${l2}</td>
      <td class="text-center">${l3}</td>
      <td class="text-center">${khac}</td>
      <td class="text-center" style="color: var(--primary-color); font-weight: bold;">${total}</td>
    `;
    tbody.appendChild(tr);
  });

  const trTotal = document.createElement('tr');
  trTotal.style.backgroundColor = '#f8f9fc';
  trTotal.innerHTML = `
    <td><strong>TỔNG CỘNG</strong></td>
    <td class="text-center" style="color: var(--primary-color); font-weight: bold;">${tongCongThang}</td>
    <td class="text-center"><strong>${tongL1}</strong></td>
    <td class="text-center"><strong>${tongL2}</strong></td>
    <td class="text-center"><strong>${tongL3}</strong></td>
    <td class="text-center"><strong>${tongKhac}</strong></td>
    <td class="text-center" style="color: var(--primary-color); font-weight: bold;">${tongTatCa}</td>
  `;
  tbody.appendChild(trTotal);
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

// --- KIỂM TRA LỖI SAI SÓT Y TẾ ---

const ERR_NAME_MAP = {
    'nguyễn thị xuân lương': 'KTV Lương', 'ktv lương': 'KTV Lương',
    'nguyễn thị hà': 'KTV Hà', 'ktv hà chip': 'KTV Hà', 'ktv hà': 'KTV Hà',
    'phan thị thu hiền': 'KTV Phan Hiền', 'ktv phan hiền': 'KTV Phan Hiền',
    'lê thị thu hiền': 'KTV Lê Hiền', 'ktv lê hiền': 'KTV Lê Hiền', 'ltv lê hiền': 'KTV Lê Hiền',
    'nguyễn văn khính': 'KTV Khính', 'ktv khính': 'KTV Khính',
    'phạm thị thuyến': 'ĐD Thuyến', 'đd thuyến': 'ĐD Thuyến', 'ktv thuyến': 'ĐD Thuyến',
    'trần thị duyên': 'ĐD Duyên', 'đd duyên': 'ĐD Duyên', 'ktv duyên': 'ĐD Duyên',
    'hoàng đức đạt': 'BS Đạt', 'bs đạt': 'BS Đạt',
    'lê thị thu hoa': 'BS Hoa', 'bs hoa': 'BS Hoa',
    'nguyễn thị duyên thảo': 'BS Thảo', 'bs thảo': 'BS Thảo', 'bs thảo 2': 'BS Thảo',
    'nguyễn thu hằng': 'BS Hằng', 'bs hằng': 'BS Hằng',
    'đặng phong thái': 'BS Thái', 'bs thái': 'BS Thái',
    'phạm thạch khuyến': 'BS Khuyến', 'bs khuyến': 'BS Khuyến'
};

const ERR_PROCEDURE_DICT = [
    {keys: ['điện châm', 'dc'], name: 'Điện châm', tth: 5, ttg: 25},
    {keys: ['thủy châm', 'tc'], name: 'Thủy châm', tth: 10, ttg: 25},
    {keys: ['xoa bóp bấm huyệt', 'xbbh', 'xb'], name: 'Xoa bóp bấm huyệt', tth: 25, ttg: 25},
    {keys: ['cấy chỉ', 'cc'], name: 'Cấy chỉ', tth: 30, ttg: 30},
    {keys: ['điện xung', 'dx'], name: 'Điều trị bằng các dòng điện xung', tth: 1, ttg: 15},
    {keys: ['parafin', 'pa'], name: 'Điều trị bằng Parafin', tth: 2, ttg: 20},
    {keys: ['siêu âm', 'sa'], name: 'Điều trị bằng siêu âm', tth: 15, ttg: 15},
    {keys: ['sóng ngắn', 'sn'], name: 'Điều trị bằng sóng ngắn', tth: 2, ttg: 15},
    {keys: ['hồng ngoại', 'hn'], name: 'Điều trị bằng tia hồng ngoại', tth: 1, ttg: 15},
    {keys: ['xoa bóp vùng', 'xbv'], name: 'Kỹ thuật xoa bóp vùng', tth: 15, ttg: 15},
    {keys: ['tập trợ giúp', 'ttg', 'trợ giúp'], name: 'Tập vận động có trợ giúp', tth: 20, ttg: 20},
    {keys: ['tập kháng trở', 'tk', 'kháng trở'], name: 'Tập vận động có kháng trở', tth: 20, ttg: 20},
    {keys: ['tập thở', 'tt', 'kiểu thở'], name: 'Tập các kiểu thở', tth: 20, ttg: 20},
    {keys: ['kéo giãn', 'kg'], name: 'Kéo giãn cột sống', tth: 3, ttg: 15}
];

const ERR_GROUP_1 = ['KTV Lương', 'KTV Hà', 'KTV Phan Hiền', 'KTV Lê Hiền', 'KTV Khính', 'ĐD Thuyến', 'ĐD Duyên'];
const ERR_GROUP_2 = ['BS Đạt', 'BS Hoa', 'BS Thảo', 'BS Hằng'];
const ERR_GROUP_3 = ['BS Thái', 'BS Khuyến'];

const ERR_PROC_G1 = ['điện xung', 'parafin', 'siêu âm', 'sóng ngắn', 'hồng ngoại', 'xoa bóp vùng', 'tập vận động có trợ giúp', 'tập vận động có kháng trở', 'tập các kiểu thở', 'kéo giãn cột sống'];
const ERR_PROC_G3 = ['điện châm', 'thủy châm', 'xoa bóp bấm huyệt', 'cấy chỉ'];
const ERR_PROC_G2 = [...ERR_PROC_G1, ...ERR_PROC_G3];

function normalizeTextJS(text) {
    if (!text || typeof text !== 'string') return '';
    return text.normalize('NFC').trim().toLowerCase();
}

function getShortNameJS(fullName) {
    const lowerName = normalizeTextJS(fullName);
    if (!lowerName) return '';
    if (ERR_NAME_MAP[lowerName]) return ERR_NAME_MAP[lowerName];
    for (const [key, val] of Object.entries(ERR_NAME_MAP)) {
        if (lowerName.includes(key)) return val;
    }
    return String(fullName).trim();
}

function mapProcedureJS(procStr) {
    const procStrLower = normalizeTextJS(procStr);
    for (const item of ERR_PROCEDURE_DICT) {
        for (const k of item.keys) {
            if (k.length <= 4) {
                if (k === procStrLower) return item;
            } else {
                if (procStrLower.includes(k)) return item;
            }
        }
    }
    return null;
}

function checkPermissionJS(techName, procName) {
    let techGroup = 0;
    if (ERR_GROUP_1.includes(techName)) techGroup = 1;
    else if (ERR_GROUP_2.includes(techName)) techGroup = 2;
    else if (ERR_GROUP_3.includes(techName)) techGroup = 3;
    else return true;

    const procLower = normalizeTextJS(procName);
    if (techGroup === 1) return ERR_PROC_G1.some(p => procLower.includes(normalizeTextJS(p)));
    if (techGroup === 2) return ERR_PROC_G2.some(p => procLower.includes(normalizeTextJS(p)));
    if (techGroup === 3) return ERR_PROC_G3.some(p => procLower.includes(normalizeTextJS(p)));
    return false;
}

function convertExcelDateToJSDate(serial) {
    if (!serial) return null;
    if (typeof serial === 'string') {
        const s = serial.trim();
        
        // 1. Format: HH:MM DD/MM/YYYY (ví dụ: 09:21 07/05/2026)
        const match1 = s.match(/^(\d{1,2}):(\d{1,2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match1) {
            return new Date(parseInt(match1[5]), parseInt(match1[4]) - 1, parseInt(match1[3]), parseInt(match1[1]), parseInt(match1[2]), 0, 0);
        }
        
        // 2. Format: DD/MM/YYYY HH:MM (ví dụ: 07/05/2026 09:21)
        const match2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})/);
        if (match2) {
            return new Date(parseInt(match2[3]), parseInt(match2[2]) - 1, parseInt(match2[1]), parseInt(match2[4]), parseInt(match2[5]), 0, 0);
        }
        
        // Fallback cho native JS (Lưu ý: new Date("07/05/2026") sẽ hiểu lầm là 05/07/2026)
        const dateObj = new Date(s);
        if (!isNaN(dateObj.getTime())) return dateObj;
        
        // Fallback chỉ có HH:MM
        const parts = s.match(/(\d+):(\d+)/);
        if (parts) {
             const d = new Date(1900, 0, 1);
             d.setHours(parseInt(parts[1]), parseInt(parts[2]), 0, 0);
             return d;
        }
        return null;
    }
    if (serial instanceof Date) return serial;
    // Excel date processing (floating point number)
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400; 
    const date_info = new Date(utc_value * 1000);
    const fractional_day = serial - Math.floor(serial) + 0.0000001;
    let total_seconds = Math.floor(86400 * fractional_day);
    const seconds = total_seconds % 60;
    total_seconds -= seconds;
    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;
    date_info.setHours(hours, minutes, seconds, 0);
    return date_info;
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '';
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    return `${h}:${m} (${d}/${mo})`;
}

function initErrorChecker() {
    const fileInput = document.getElementById('error-file-input');
    if (!fileInput) return;
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showLoading(true);
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                // cellDates: false ensures we get Excel's serial numbers for precise calculation
                const workbook = XLSX.read(data, { type: 'array', cellDates: false });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                // Read starting from Excel row 13 (index 12), header is row 12 (index 11). range = 11 in SheetJS means header is at row index 11.
                const dataRows = XLSX.utils.sheet_to_json(worksheet, { header: "A", range: 11, defval: "" });
                processErrorChecking(dataRows);
            } catch (err) {
                console.error(err);
                alert("Lỗi khi đọc file. Vui lòng kiểm tra lại cấu trúc form.");
            } finally {
                showLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function processErrorChecking(dataRows) {
    const timeTbody = document.getElementById('error-time-body');
    const otherTbody = document.getElementById('error-other-body');
    timeTbody.innerHTML = '';
    otherTbody.innerHTML = '';

    let sttTime = 1;
    let sttOther = 1;

    // Grouping
    const grouped = {};
    const validStaff = [...ERR_GROUP_1, ...ERR_GROUP_2, ...ERR_GROUP_3];

    for (let row of dataRows) {
        if (!row['AH'] || !row['L']) continue;
        
        let start = convertExcelDateToJSDate(row['AH']);
        let end = convertExcelDateToJSDate(row['L']);
        if (!start || isNaN(start.getTime()) || !end || isNaN(end.getTime())) continue;

        let techRaw = String(row['AT'] || '').trim();
        let techNorm = getShortNameJS(techRaw);
        if (!techNorm) continue;
        
        if (!grouped[techNorm]) grouped[techNorm] = [];
        
        grouped[techNorm].push({
            raw: row,
            patientName: String(row['C'] || 'Không rõ'),
            procName: String(row['AE'] || ''),
            ptttStatus: String(row['AF'] || ''),
            anesName: String(row['AS'] || ''),
            techRaw: techRaw,
            start: start,
            end: end
        });
    }

    // Process logic
    for (const [tech, groupRows] of Object.entries(grouped)) {
        groupRows.sort((a, b) => a.start - b.start);
        const fastRows = [];

        for (const row of groupRows) {
            const procInfo = mapProcedureJS(row.procName);
            const timeAStr = `${formatDate(row.start)} -> ${formatDate(row.end)}`;
            
            // 1. Sai tên nhân viên
            if (!validStaff.includes(tech)) {
                addOtherRow(otherTbody, sttOther++, row.techRaw, `${row.patientName}<br/>${row.procName}`, timeAStr, "Sai tên nhân viên (Không có trong CSDL)");
            }
            
            // 2. Sai Tình hình PTTT
            const status = String(row.ptttStatus).trim().toLowerCase();
            if (status !== "chủ động" && status !== "nan" && status !== "") {
                addOtherRow(otherTbody, sttOther++, tech, `${row.patientName}<br/>${row.procName}`, timeAStr, `Sai Tình hình PTTT: '${row.ptttStatus}' (Phải là Chủ động)`);
            }
            
            // 3. Sai Vô Cảm
            const anes = String(row.anesName).trim().toLowerCase();
            if (anes !== "khác" && anes !== "nan" && anes !== "") {
                addOtherRow(otherTbody, sttOther++, tech, `${row.patientName}<br/>${row.procName}`, timeAStr, `Sai Vô cảm: '${row.anesName}' (Bắt buộc Khác)`);
            }

            if (!procInfo) continue;

            // 4. Sai Phân quyền
            if (!checkPermissionJS(tech, procInfo.name)) {
                addOtherRow(otherTbody, sttOther++, tech, `${row.patientName}<br/>${procInfo.name}`, timeAStr, "Làm thủ thuật ngoài phạm vi phân quyền");
            }
            
            const execEnd = new Date(row.start.getTime() + procInfo.tth * 60000);
            
            fastRows.push({
                raw: row,
                info: procInfo,
                start: row.start,
                end: row.end,
                execEnd: execEnd,
                isCont: procInfo.tth === procInfo.ttg
            });
        }

        // Time overlap logic
        const n = fastRows.length;
        for (let i = 0; i < n; i++) {
            const A = fastRows[i];
            const timeAStr = `${formatDate(A.start)} -> ${formatDate(A.end)}`;
            for (let j = i + 1; j < n; j++) {
                const B = fastRows[j];
                if (B.start.getTime() > A.end.getTime()) break; // sorted by start time
                
                let errorReason = "";
                const aTc = A.info.name === 'Thủy châm';
                const bTc = B.info.name === 'Thủy châm';
                
                const inExec = (s, pt, e) => (pt <= s && s < e);
                const overlap = (s1, e1, s2, e2) => (Math.max(s1, s2) < Math.min(e1, e2));
                
                const bStart = B.start.getTime();
                const bEnd = B.end.getTime();
                const aStart = A.start.getTime();
                const aEnd = A.end.getTime();
                const aExecEnd = A.execEnd.getTime();
                const bExecEnd = B.execEnd.getTime();

                if (bStart === aStart) errorReason = "Trùng giờ bắt đầu";
                else if (!aTc && bStart === aEnd) errorReason = "Trùng giờ bắt đầu hoặc kết thúc";
                else if (!bTc && bEnd === aStart) errorReason = "Trùng giờ bắt đầu hoặc kết thúc";
                else if (!aTc && !bTc && bEnd === aEnd) errorReason = "Trùng giờ bắt đầu hoặc kết thúc";
                else if (inExec(bStart, aStart, aExecEnd)) errorReason = `Giờ bắt đầu Ca B rơi vào thời gian thực hiện của ${A.info.name}`;
                else if (!bTc && inExec(bEnd, aStart, aExecEnd)) errorReason = `Giờ kết thúc Ca B rơi vào thời gian thực hiện của ${A.info.name}`;
                else if (inExec(aStart, bStart, bExecEnd)) errorReason = `Giờ bắt đầu Ca A rơi vào thời gian thực hiện của ${B.info.name}`;
                else if (!aTc && inExec(aEnd, bStart, bExecEnd)) errorReason = `Giờ kết thúc Ca A rơi vào thời gian thực hiện của ${B.info.name}`;
                else if (A.isCont && overlap(aStart, aEnd, bStart, bEnd)) errorReason = `Đè lên thời gian liên tục của ${A.info.name} (Ca A)`;
                else if (B.isCont && overlap(bStart, bEnd, aStart, aEnd)) errorReason = `Đè lên thời gian liên tục của ${B.info.name} (Ca B)`;
                
                if (errorReason) {
                    const timeBStr = `${formatDate(B.start)} -> ${formatDate(B.end)}`;
                    addTimeRow(timeTbody, sttTime++, tech, 
                        `${A.raw.patientName}<br/>${A.info.name}<br/><span style="color:var(--primary-color)">${timeAStr}</span>`,
                        `${B.raw.patientName}<br/>${B.info.name}<br/><span style="color:var(--primary-color)">${timeBStr}</span>`,
                        errorReason);
                }
            }
        }
    }

    if (sttTime === 1) timeTbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: green; font-weight: bold;">✅ CHÚC MỪNG! Không phát hiện lỗi trùng lặp giờ nào.</td></tr>`;
    if (sttOther === 1) otherTbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: green; font-weight: bold;">✅ CHÚC MỪNG! Không phát hiện sai quy trình/phân quyền nào.</td></tr>`;
    
    showToast(`Đã kiểm tra xong! ${sttTime-1} lỗi trùng giờ, ${sttOther-1} lỗi sai quy trình/phân quyền.`);
}

function addTimeRow(tbody, stt, tech, ca1, ca2, reason) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center">${stt}</td>
        <td><strong>${tech}</strong></td>
        <td>${ca1}</td>
        <td>${ca2}</td>
        <td style="color: #dc3545; font-weight: 500;">${reason}</td>
    `;
    tbody.appendChild(tr);
}

function addOtherRow(tbody, stt, tech, info, timeStr, reason) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center">${stt}</td>
        <td><strong>${tech}</strong></td>
        <td>${info}</td>
        <td><span style="color:var(--primary-color)">${timeStr}</span></td>
        <td style="color: #fd7e14; font-weight: 500;">${reason}</td>
    `;
    tbody.appendChild(tr);
}
