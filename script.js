/**
 * CẤU HÌNH GOOGLE APPS SCRIPT
 * Dán URL của Web App sau khi Deploy trên Google Apps Script vào biến dưới đây.
 */
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxNQXg2uLWsAt8LgUdaCTlMRR_1vRrCdCAJl-bUOCNvuU7MzM2CqnXt1kncjhamE2V4Sw/exec';

// Trạng thái ứng dụng
let currentMonthYear = '';
let employees = JSON.parse(localStorage.getItem('med_employees')) || [];
let chamCongData = {}; // { "Nguyễn Văn A": { "1": "sang", "2": "ca-ngay", ... } }
let thuThuatData = {}; // { "Nguyễn Văn A": { loai1: 0, loai2: 0, loai3: 0 } }

let saveTimeout = null;

// Khởi tạo
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initMonthYearPicker();
  initThongKeMode();
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
  const dateSelector = document.querySelector('.date-selector');

  const switchTab = (tabId) => {
    links.forEach(l => l.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));

    const activeLink = Array.from(links).find(l => l.getAttribute('data-tab') === tabId);
    if (activeLink) {
      activeLink.classList.add('active');
      document.getElementById('page-title').innerText = activeLink.querySelector('span').innerText;
    }

    const activePane = document.getElementById(tabId);
    if (activePane) activePane.classList.add('active');

    if (tabId === 'tab-kiemtra' || tabId === 'tab-nhanvien' || tabId === 'tab-caidat') {
      dateSelector.style.display = 'none';
    } else {
      dateSelector.style.display = '';
    }

    if (tabId === 'tab-thongke') {
      renderThongKeTable();
    }
    if (tabId === 'tab-tongquan') {
      renderDashboard();
    }
  };

  links.forEach(link => {
    link.addEventListener('click', () => {
      const tabId = link.getAttribute('data-tab');
      window.location.hash = tabId;
    });
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      switchTab(hash);
    }
  });

  // Tải tab mặc định từ URL, nếu không có thì mặc định là tab đầu tiên
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash) {
    switchTab(initialHash);
  } else {
    // Kích hoạt tab mặc định
    const firstTab = links[0].getAttribute('data-tab');
    switchTab(firstTab);
  }
}

function initMonthYearPicker() {
  const mPicker = document.getElementById('month-picker');
  const yPicker = document.getElementById('year-picker');
  const now = new Date();

  mPicker.value = now.getMonth() + 1;
  yPicker.value = now.getFullYear();

  const updateCurrentMonthYear = () => {
    let m = parseInt(mPicker.value);
    let y = parseInt(yPicker.value);

    // Xử lý khi tăng/giảm qua giới hạn tháng
    if (m > 12) { m = 1; y++; mPicker.value = 1; yPicker.value = y; }
    if (m < 1) { m = 12; y--; mPicker.value = 12; yPicker.value = y; }

    const monthStr = String(m).padStart(2, '0');
    currentMonthYear = `${y}-${monthStr}`;
    
    // Nếu đang ở mode xem Quý thì load lại Quý (vì năm có thể đổi), ngược lại load tháng
    if (typeof thongKeMode !== 'undefined' && thongKeMode !== 'current') {
      fetchQuarterData(thongKeMode);
    } else {
      fetchDataFromServer();
    }
  };

  mPicker.addEventListener('change', updateCurrentMonthYear);
  yPicker.addEventListener('change', updateCurrentMonthYear);

  updateCurrentMonthYear(); // Fetch dữ liệu lần đầu
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
  
  // Tự động focus vào nút OK để người dùng có thể ấn Enter ngay lập tức
  setTimeout(() => {
    document.getElementById('btn-confirm-ok').focus();
  }, 100);
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
    const empName = employees[index];
    employees.splice(index, 1);
    
    // Xóa vĩnh viễn trên bộ nhớ tạm
    if (chamCongData[empName]) delete chamCongData[empName];
    if (thuThuatData[empName]) delete thuThuatData[empName];
    
    saveEmployeesLocally();
    renderEmployeesTable();
    renderChamCongTable();
    
    // Đồng bộ lệnh xóa lên máy chủ
    triggerAutoSaveChamCong();
    saveThuThuatToServer();
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
    tr.setAttribute('draggable', 'true');
    tr.setAttribute('data-index', index);
    tr.style.cursor = 'grab';
    tr.innerHTML = `
      <td style="color: #888;"><i class='bx bx-menu'></i> ${index + 1}</td>
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

    // Sự kiện kéo thả
    tr.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      tr.style.opacity = '0.5';
      setTimeout(() => tr.classList.add('dragging'), 0);
    });

    tr.addEventListener('dragend', () => {
      tr.style.opacity = '1';
      tr.classList.remove('dragging');
      renderEmployeesTable(); // Xóa các border highlight còn sót lại
    });

    tr.addEventListener('dragover', (e) => {
      e.preventDefault();
      const currentElement = e.target.closest('tr');
      if (currentElement && !currentElement.classList.contains('dragging')) {
        const bounding = currentElement.getBoundingClientRect();
        const offset = bounding.y + (bounding.height / 2);
        if (e.clientY - offset > 0) {
          currentElement.style.borderBottom = "2px solid var(--primary-color)";
          currentElement.style.borderTop = "";
        } else {
          currentElement.style.borderTop = "2px solid var(--primary-color)";
          currentElement.style.borderBottom = "";
        }
      }
    });

    tr.addEventListener('dragleave', (e) => {
      const currentElement = e.target.closest('tr');
      if (currentElement && !currentElement.classList.contains('dragging')) {
        currentElement.style.borderTop = "";
        currentElement.style.borderBottom = "";
      }
    });

    tr.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const targetIndex = index;
      
      if (draggedIndex === targetIndex || isNaN(draggedIndex)) return;
      
      const draggedItem = employees.splice(draggedIndex, 1)[0];
      
      // Điều chỉnh vị trí chèn dựa trên việc kéo lên hay kéo xuống
      const bounding = tr.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      let insertIndex = targetIndex;
      
      if (draggedIndex < targetIndex && e.clientY < offset) {
        insertIndex--;
      } else if (draggedIndex > targetIndex && e.clientY > offset) {
        insertIndex++;
      }
      
      employees.splice(insertIndex, 0, draggedItem);
      
      saveEmployeesLocally();
      renderEmployeesTable();
      renderChamCongTable();
    });

    tbody.appendChild(tr);
  });
}

// --- HELPER BẢNG CHẤM CÔNG ---
function isHoliday(y, m, d) {
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = dateObj.getDay();
  // Cuối tuần
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  
  // Ngày lễ dương lịch cố định
  const md = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const solarHolidays = ['01-01', '04-30', '05-01', '09-01', '09-02']; 
  if (solarHolidays.includes(md)) return true;
  
  // Các ngày lễ âm lịch (Giỗ tổ, Tết) năm 2024 - 2027
  const extraHolidays = [
    '2024-04-18', '2024-02-08','2024-02-09','2024-02-10','2024-02-11','2024-02-12','2024-02-13','2024-02-14',
    '2025-04-07', '2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-01','2025-02-02','2025-02-03',
    '2026-04-26', '2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-21','2026-02-22',
    '2027-04-16', '2027-02-05','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-02-10','2027-02-11'
  ];
  const ymd = `${y}-${md}`;
  if (extraHolidays.includes(ymd)) return true;
  
  return false;
}

function getWeekdayName(y, m, d) {
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return days[new Date(y, m - 1, d).getDay()];
}

// --- BẢNG CHẤM CÔNG ---
function renderChamCongTable() {
  if (!currentMonthYear) return;
  const [year, month] = currentMonthYear.split('-');
  const daysInMonth = new Date(year, month, 0).getDate();

  const thead = document.getElementById('chamcong-thead');
  const tbody = document.getElementById('chamcong-body');

  // Header
  let theadHtml = `<tr><th rowspan="2" style="vertical-align: middle;">Tên Nhân Viên</th>`;
  let weekHtml = `<tr>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const isOff = isHoliday(year, month, d);
    const bgClass = isOff ? 'bg-holiday' : '';
    theadHtml += `<th class="${bgClass} text-center">Ngày ${d}</th>`;
    weekHtml += `<th class="${bgClass} text-center" style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">${getWeekdayName(year, month, d)}</th>`;
  }
  
  theadHtml += `<th rowspan="2" style="vertical-align: middle; text-align: center;">Tổng Công</th></tr>`;
  weekHtml += `</tr>`;
  
  thead.innerHTML = theadHtml + weekHtml;

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
      
      const isOff = isHoliday(year, month, d);
      const bgClass = isOff ? 'bg-holiday' : '';

      rowHtml += `
        <td class="text-center ${bgClass}" style="vertical-align: middle;">
          <div class="cell-checkbox-group ${colorClass}" id="group-${emp.replace(/\s+/g, '')}-${d}">
            <label><input type="checkbox" class="cb-sang" data-emp="${emp}" data-day="${d}" ${val === 'sang' || val === 'ca-ngay' ? 'checked' : ''}> Sáng</label>
            <label><input type="checkbox" class="cb-chieu" data-emp="${emp}" data-day="${d}" ${val === 'chieu' || val === 'ca-ngay' ? 'checked' : ''}> Chiều</label>
          </div>
        </td>
      `;
    }
    rowHtml += `<td class="tong-cong-cell text-center" data-emp-total="${emp}" style="font-size: 1.1rem; color: var(--primary-color);"><strong>${tongCong}</strong></td>`;
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });

  // Gán sự kiện thay đổi
  document.querySelectorAll('.cb-sang, .cb-chieu').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const emp = e.target.getAttribute('data-emp');
      const day = e.target.getAttribute('data-day');
      
      const groupId = `group-${emp.replace(/\s+/g, '')}-${day}`;
      const group = document.getElementById(groupId);
      
      const cbSang = group.querySelector('.cb-sang').checked;
      const cbChieu = group.querySelector('.cb-chieu').checked;
      
      let val = '';
      if (cbSang && cbChieu) val = 'ca-ngay';
      else if (cbSang) val = 'sang';
      else if (cbChieu) val = 'chieu';

      // Cập nhật màu group
      group.className = 'cell-checkbox-group';
      if (val) group.classList.add(`val-${val}`);

      // Lưu vào state
      if (val) {
        chamCongData[emp][day] = val;
      } else {
        delete chamCongData[emp][day];
      }

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

let tempThuThuatData = null;

function initExcelUploader() {
  const fileInput = document.getElementById('excel-file-input');
  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showLoading(true);
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const dataRows = XLSX.utils.sheet_to_json(worksheet, { header: "A", defval: "", blankrows: true });

        processExcelData(dataRows);
      } catch (err) {
        console.error(err);
        alert("Có lỗi khi đọc file Excel.");
      } finally {
        showLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    fileInput.value = '';
  });

  // Sự kiện khi bấm nút Xác nhận lưu
  const btnSubmit = document.getElementById('btn-submit-thuthuat');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => {
      if (!tempThuThuatData) return;
      thuThuatData = tempThuThuatData; // Ghi đè vào data chính thức
      tempThuThuatData = null;

      // Đóng bảng preview, mở lại bảng chính
      document.getElementById('preview-section').classList.add('hidden');
      document.getElementById('main-thongke-container').classList.remove('hidden');

      // Cập nhật lại UI
      renderThongKeTable();
      // Lưu lên server
      saveThuThuatToServer();
    });
  }
}

function processExcelData(dataRows) {
  tempThuThuatData = {}; // Dùng biến tạm

  // Khởi tạo sẵn
  employees.forEach(emp => {
    tempThuThuatData[emp] = { loai1: 0, loai2: 0, loai3: 0, khac: 0 };
  });

  // Duyệt dữ liệu
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row) continue;

    const loaiTT = row['AN'];
    let rawEmpName = row['AT'];

    if (!rawEmpName) continue;
    rawEmpName = String(rawEmpName).trim();
    if (!rawEmpName) continue;
    
    const rawEmpNameNormalized = rawEmpName.normalize('NFC').toLowerCase();
    if (rawEmpNameNormalized.includes('thủ thuật viên') || rawEmpNameNormalized.includes('tên nhân viên')) continue;

    const matchedEmp = employees.find(e => e.normalize('NFC').toLowerCase() === rawEmpNameNormalized);
    if (!matchedEmp) continue;

    if (loaiTT) {
      const strLoai = String(loaiTT).normalize('NFC').toLowerCase();
      if (strLoai.includes('loại 1')) tempThuThuatData[matchedEmp].loai1++;
      else if (strLoai.includes('loại 2')) tempThuThuatData[matchedEmp].loai2++;
      else if (strLoai.includes('loại 3')) tempThuThuatData[matchedEmp].loai3++;
      else tempThuThuatData[matchedEmp].khac++;
    }
  }

  // Vẽ bảng Preview
  const tbody = document.getElementById('preview-thuthuat-body');
  if (tbody) {
    tbody.innerHTML = '';
    let tongL1 = 0, tongL2 = 0, tongL3 = 0, tongTatCa = 0;

    for (const [emp, stats] of Object.entries(tempThuThuatData)) {
      const l1 = stats.loai1 || 0;
      const l2 = stats.loai2 || 0;
      const l3 = stats.loai3 || 0;
      const total = l1 + l2 + l3;

      tongL1 += l1; tongL2 += l2; tongL3 += l3; tongTatCa += total;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${emp}</strong></td>
        <td class="text-center">${l1}</td>
        <td class="text-center">${l2}</td>
        <td class="text-center">${l3}</td>
        <td class="text-center" style="color: var(--primary-color); font-weight: bold;">${total}</td>
      `;
      tbody.appendChild(tr);
    }

    const trTotal = document.createElement('tr');
    trTotal.style.backgroundColor = '#f8f9fc';
    trTotal.innerHTML = `
      <td><strong>TỔNG CỘNG</strong></td>
      <td class="text-center"><strong>${tongL1}</strong></td>
      <td class="text-center"><strong>${tongL2}</strong></td>
      <td class="text-center"><strong>${tongL3}</strong></td>
      <td class="text-center" style="color: var(--primary-color); font-weight: bold;">${tongTatCa}</td>
    `;
    tbody.appendChild(trTotal);
  }

  // Ẩn bảng chính, hiện bảng preview
  document.getElementById('main-thongke-container').classList.add('hidden');
  document.getElementById('preview-section').classList.remove('hidden');
}

// --- THỐNG KÊ TỔNG HỢP ---
let thongKeMode = 'current'; // 'current', 'q1', 'q2', 'q3', 'q4'
let thongKeQuarterData = { chamcong: {}, thuthuat: {} }; // Cache cho dữ liệu quý

function initThongKeMode() {
  const modeSelect = document.getElementById('thongke-mode');
  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      thongKeMode = e.target.value;
      if (thongKeMode === 'current') {
        renderThongKeTable();
      } else {
        fetchQuarterData(thongKeMode);
      }
    });
  }
}

function fetchQuarterData(mode) {
  showLoading(true);
  const year = document.getElementById('year-picker').value;
  let months = [];
  if (mode === 'q1') months = ['01', '02', '03'];
  else if (mode === 'q2') months = ['04', '05', '06'];
  else if (mode === 'q3') months = ['07', '08', '09'];
  else if (mode === 'q4') months = ['10', '11', '12'];
  
  Promise.all(months.map(m => 
    fetch(`${GAS_WEBAPP_URL}?action=getAllData&monthYear=${year}-${m}`, { redirect: 'follow' }).then(res => res.json())
  ))
  .then(results => {
    let mergedChamCong = {};
    let mergedThuThuat = {};
    
    results.forEach(res => {
       if(res.status === 'success') {
          const cc = res.data.chamcong || {};
          const tt = res.data.thuthuat || {};
          
          Object.keys(cc).forEach(emp => {
             if(!mergedChamCong[emp]) mergedChamCong[emp] = 0;
             Object.values(cc[emp]).forEach(val => {
                if (val === 'sang' || val === 'chieu') mergedChamCong[emp] += 0.5;
                else if (val === 'ca-ngay') mergedChamCong[emp] += 1;
             });
          });
          
          Object.keys(tt).forEach(emp => {
             if(!mergedThuThuat[emp]) mergedThuThuat[emp] = { loai1:0, loai2:0, loai3:0, khac:0 };
             mergedThuThuat[emp].loai1 += (tt[emp].loai1 || 0);
             mergedThuThuat[emp].loai2 += (tt[emp].loai2 || 0);
             mergedThuThuat[emp].loai3 += (tt[emp].loai3 || 0);
             mergedThuThuat[emp].khac += (tt[emp].khac || 0);
          });
       }
    });
    
    thongKeQuarterData.chamcong = mergedChamCong;
    thongKeQuarterData.thuthuat = mergedThuThuat;
    renderThongKeTable();
  })
  .catch(err => {
    console.error(err);
    alert("Lỗi khi tải dữ liệu Quý");
  })
  .finally(() => showLoading(false));
}

function renderThongKeTable() {
  const tbody = document.getElementById('thongke-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  let tongCongThang = 0;
  let tongL1 = 0, tongL2 = 0, tongL3 = 0, tongKhac = 0, tongTatCa = 0;
  
  const isQ = (typeof thongKeMode !== 'undefined' && thongKeMode !== 'current');
  const sourceChamCong = isQ ? thongKeQuarterData.chamcong : chamCongData;
  const sourceThuThuat = isQ ? thongKeQuarterData.thuthuat : thuThuatData;

  employees.forEach(emp => {
    let tongCong = 0;
    if (isQ) {
      tongCong = sourceChamCong[emp] || 0;
    } else {
      const cc = sourceChamCong[emp] || {};
      Object.values(cc).forEach(val => {
        if (val === 'sang' || val === 'chieu') tongCong += 0.5;
        else if (val === 'ca-ngay') tongCong += 1;
      });
    }
    tongCongThang += tongCong;

    const tt = sourceThuThuat[emp] || { loai1: 0, loai2: 0, loai3: 0 };
    const l1 = tt.loai1 || 0;
    const l2 = tt.loai2 || 0;
    const l3 = tt.loai3 || 0;
    const tongTT = l1 + l2 + l3;

    tongL1 += l1; tongL2 += l2; tongL3 += l3; tongTatCa += tongTT;

    const tr = document.createElement('tr');
    
    if (isQ) {
      tr.innerHTML = `
        <td><strong>${emp}</strong></td>
        <td class="text-center" style="font-weight: bold; color: var(--primary-color);">${tongCong}</td>
        <td class="text-center">${l1}</td>
        <td class="text-center">${l2}</td>
        <td class="text-center">${l3}</td>
        <td class="text-center" style="font-weight: bold; color: var(--success-dark);">${tongTT}</td>
      `;
    } else {
      tr.innerHTML = `
        <td><strong>${emp}</strong></td>
        <td class="text-center" style="font-weight: bold; color: var(--primary-color);">${tongCong}</td>
        <td class="text-center"><input type="number" class="thuthuat-input" data-emp="${emp}" data-type="loai1" value="${l1}" min="0"></td>
        <td class="text-center"><input type="number" class="thuthuat-input" data-emp="${emp}" data-type="loai2" value="${l2}" min="0"></td>
        <td class="text-center"><input type="number" class="thuthuat-input" data-emp="${emp}" data-type="loai3" value="${l3}" min="0"></td>
        <td class="text-center tt-total" style="font-weight: bold; color: var(--success-dark);">${tongTT}</td>
      `;
      
      // Gắn sự kiện thay đổi
      const inputs = tr.querySelectorAll('.thuthuat-input');
      inputs.forEach(input => {
        input.addEventListener('input', (e) => {
          const type = e.target.getAttribute('data-type');
          const val = parseInt(e.target.value) || 0;
          
          if (!thuThuatData[emp]) thuThuatData[emp] = { loai1: 0, loai2: 0, loai3: 0 };
          thuThuatData[emp][type] = val;
          
          // Cập nhật lại tổng ngang
          const newTotal = (thuThuatData[emp].loai1 || 0) + (thuThuatData[emp].loai2 || 0) + (thuThuatData[emp].loai3 || 0);
          tr.querySelector('.tt-total').innerText = newTotal;
          
          // Cập nhật lại tổng dọc (dòng TỔNG CỘNG)
          if (!isQ) {
            let totalL1 = 0, totalL2 = 0, totalL3 = 0;
            tbody.querySelectorAll('input[data-type="loai1"]').forEach(el => totalL1 += parseInt(el.value) || 0);
            tbody.querySelectorAll('input[data-type="loai2"]').forEach(el => totalL2 += parseInt(el.value) || 0);
            tbody.querySelectorAll('input[data-type="loai3"]').forEach(el => totalL3 += parseInt(el.value) || 0);
            
            const sumL1 = document.getElementById('sum-l1');
            const sumL2 = document.getElementById('sum-l2');
            const sumL3 = document.getElementById('sum-l3');
            const sumTotal = document.getElementById('sum-total');
            
            if (sumL1) sumL1.innerText = totalL1;
            if (sumL2) sumL2.innerText = totalL2;
            if (sumL3) sumL3.innerText = totalL3;
            if (sumTotal) sumTotal.innerText = totalL1 + totalL2 + totalL3;
          }
          
          triggerAutoSaveThuThuat();
        });
      });
    }
    tbody.appendChild(tr);
  });

  const trTotal = document.createElement('tr');
  trTotal.style.backgroundColor = '#f8f9fc';
  trTotal.innerHTML = `
    <td><strong>TỔNG CỘNG</strong></td>
    <td class="text-center" style="font-weight: bold; color: var(--primary-color);">${tongCongThang}</td>
    <td class="text-center"><strong id="sum-l1">${tongL1}</strong></td>
    <td class="text-center"><strong id="sum-l2">${tongL2}</strong></td>
    <td class="text-center"><strong id="sum-l3">${tongL3}</strong></td>
    <td class="text-center" style="font-weight: bold; color: var(--success-dark);"><strong id="sum-total">${tongTatCa}</strong></td>
  `;
  tbody.appendChild(trTotal);
}

function initExportExcel() {
  document.getElementById('btn-export-excel').addEventListener('click', async () => {
    try {
      showLoading(true);
      // Tải file mẫu từ server
      const response = await fetch('mau-bang-tien.xlsx');
      if (!response.ok) throw new Error("Không tìm thấy file mẫu mau-bang-tien.xlsx");
      
      const arrayBuffer = await response.arrayBuffer();
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      const getCellValueStr = (cell) => {
        let val = cell.value;
        if (val && typeof val === 'object') {
          if (val.richText) return val.richText.map(r => r.text).join('');
          if (val.result !== undefined) return val.result;
        }
        return val ? String(val).trim() : '';
      };

      const setCellValueSafe = (ws, cellRef, newValue) => {
        const cell = ws.getCell(cellRef);
        if (cell.type === 6 || cell.formula || cell.sharedFormula) { // 6 is Formula type
          cell.value = {
            formula: cell.formula,
            sharedFormula: cell.sharedFormula,
            result: newValue
          };
        } else {
          cell.value = newValue;
        }
      };

      const readMoney = (num) => {
        if (num === 0) return "Không đồng chẵn.";
        const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
        const textNumbers = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

        function readBlock(n, isFull) {
            let text = "";
            const c = Math.floor(n / 100);
            const b = Math.floor((n % 100) / 10);
            const a = n % 10;

            if (isFull || c > 0) text += textNumbers[c] + " trăm ";
            
            if (b === 0) {
                if (a > 0 && (isFull || c > 0)) text += "lẻ ";
            } else if (b === 1) {
                text += "mười ";
            } else {
                text += textNumbers[b] + " mươi ";
            }

            if (a > 0) {
                if (b > 1 && a === 1) text += "mốt ";
                else if (b > 0 && a === 5) text += "lăm ";
                else text += textNumbers[a] + " ";
            }
            return text.trim();
        }

        let textStr = "";
        let i = 0;
        let pNum = num;
        while (pNum > 0) {
            let block = pNum % 1000;
            let hasMore = Math.floor(pNum / 1000) > 0;
            if (block > 0) {
                let str = readBlock(block, hasMore);
                textStr = str + " " + units[i] + " " + textStr;
            } else if (hasMore && i === 3) {
                // Special case for billion when inner blocks are zero
                textStr = units[i] + " " + textStr;
            }
            pNum = Math.floor(pNum / 1000);
            i++;
        }

        textStr = textStr.trim();
        return textStr.charAt(0).toUpperCase() + textStr.slice(1) + " đồng chẵn.";
      };

      const isQ = (typeof thongKeMode !== 'undefined' && thongKeMode !== 'current');
      const activeTTData = isQ ? thongKeQuarterData.thuthuat : thuThuatData;
      
      const yStr = document.getElementById('year-picker').value;
      let titleStr = '';
      let lastDayObj = null;

      if (isQ) {
        const qMap = { q1: 'QUÝ I', q2: 'QUÝ II', q3: 'QUÝ III', q4: 'QUÝ IV' };
        const qMonthMap = { q1: 3, q2: 6, q3: 9, q4: 12 };
        titleStr = `${qMap[thongKeMode]} NĂM ${yStr}`;
        lastDayObj = { y: yStr, m: String(qMonthMap[thongKeMode]).padStart(2, '0') };
      } else {
        const [year, month] = currentMonthYear.split('-');
        titleStr = `THÁNG ${month} NĂM ${year}`;
        lastDayObj = { y: year, m: month };
      }

      const updateDateInSheet = (ws) => {
        if (!ws) return;
        ws.eachRow((row) => {
          row.eachCell((cell) => {
            const cellStr = getCellValueStr(cell);
            if (cellStr && cellStr.includes('Mạo Khê, ngày')) {
              const lastDay = new Date(lastDayObj.y, lastDayObj.m, 0).getDate();
              setCellValueSafe(ws, cell.address, `Mạo Khê, ngày ${String(lastDay).padStart(2, '0')} tháng ${lastDayObj.m} năm ${lastDayObj.y}`);
            }
          });
        });
      };

      const priceL1 = 37500;
      const priceL2 = 19500;
      const priceL3 = 15000;
      let totalL1 = 0, totalL2 = 0, totalL3 = 0;

      // ================= SHEET 1 =================
      const ws1 = workbook.getWorksheet(1);
      if (ws1) {
        setCellValueSafe(ws1, 'A5', titleStr);
        updateDateInSheet(ws1);

        let row1 = 10;
        while (true) {
          const cell = ws1.getCell(`B${row1}`);
          const cellStr = getCellValueStr(cell);
          if (!cellStr || cellStr.includes('TỔNG') || cellStr === '0') break; 
          
          const empName = cellStr.normalize('NFC').toLowerCase().trim();
          
          let stats = null;
          for (const [key, value] of Object.entries(activeTTData)) {
            if (key.normalize('NFC').toLowerCase().trim() === empName) {
              stats = value;
              break;
            }
          }
          
          if (stats) {
            totalL1 += stats.loai1 || 0;
            totalL2 += stats.loai2 || 0;
            totalL3 += stats.loai3 || 0;

            if (stats.loai1 > 0) {
              setCellValueSafe(ws1, `C${row1}`, stats.loai1);
              setCellValueSafe(ws1, `D${row1}`, stats.loai1 * priceL1);
            }
            if (stats.loai2 > 0) {
              setCellValueSafe(ws1, `E${row1}`, stats.loai2);
              setCellValueSafe(ws1, `F${row1}`, stats.loai2 * priceL2);
            }
            if (stats.loai3 > 0) {
              setCellValueSafe(ws1, `G${row1}`, stats.loai3);
              setCellValueSafe(ws1, `H${row1}`, stats.loai3 * priceL3);
            }
            const rowMoney = (stats.loai1 * priceL1) + (stats.loai2 * priceL2) + (stats.loai3 * priceL3);
            if (rowMoney > 0) setCellValueSafe(ws1, `I${row1}`, rowMoney);
          }
          row1++;
        }
        
        // Điền tổng cộng ở cuối bảng Sheet 1
        setCellValueSafe(ws1, `C${row1}`, totalL1);
        setCellValueSafe(ws1, `D${row1}`, totalL1 * priceL1);
        setCellValueSafe(ws1, `E${row1}`, totalL2);
        setCellValueSafe(ws1, `F${row1}`, totalL2 * priceL2);
        setCellValueSafe(ws1, `G${row1}`, totalL3);
        setCellValueSafe(ws1, `H${row1}`, totalL3 * priceL3);
        setCellValueSafe(ws1, `I${row1}`, (totalL1 * priceL1) + (totalL2 * priceL2) + (totalL3 * priceL3));
      }

      // ================= SHEET 2 =================
      const ws2 = workbook.getWorksheet(2);
      if (ws2) {
        setCellValueSafe(ws2, 'A5', titleStr);
        updateDateInSheet(ws2);

        setCellValueSafe(ws2, 'B8', totalL1);
        setCellValueSafe(ws2, 'D8', totalL1 * priceL1);

        setCellValueSafe(ws2, 'B9', totalL2);
        setCellValueSafe(ws2, 'D9', totalL2 * priceL2);

        setCellValueSafe(ws2, 'B10', totalL3);
        setCellValueSafe(ws2, 'D10', totalL3 * priceL3);

        setCellValueSafe(ws2, 'B11', totalL1 + totalL2 + totalL3);
        setCellValueSafe(ws2, 'D11', (totalL1 * priceL1) + (totalL2 * priceL2) + (totalL3 * priceL3));
      }

      // ================= SHEET 3 =================
      const ws3 = workbook.getWorksheet(3);
      if (ws3) {
        setCellValueSafe(ws3, 'A5', titleStr);
        updateDateInSheet(ws3);

        let row3 = 7;
        while (true) {
          const cell = ws3.getCell(`B${row3}`);
          const cellStr = getCellValueStr(cell);
          if (!cellStr || cellStr.includes('CỘNG')) break;
          
          const empName = cellStr.normalize('NFC').toLowerCase().trim();
          
          let stats = null;
          for (const [key, value] of Object.entries(activeTTData)) {
            if (key.normalize('NFC').toLowerCase().trim() === empName) {
              stats = value;
              break;
            }
          }
          
          if (stats) {
            const rowMoney = (stats.loai1 * priceL1) + (stats.loai2 * priceL2) + (stats.loai3 * priceL3);
            if (rowMoney > 0) setCellValueSafe(ws3, `I${row3}`, rowMoney);
          }
          row3++;
        }
        
        // Cập nhật tổng tiền Sheet 3
        setCellValueSafe(ws3, `I${row3}`, (totalL1 * priceL1) + (totalL2 * priceL2) + (totalL3 * priceL3));
        
        // Điền tổng tiền bằng chữ vào Sheet 3 (C22)
        const totalAllMoney = (totalL1 * priceL1) + (totalL2 * priceL2) + (totalL3 * priceL3);
        setCellValueSafe(ws3, 'C22', readMoney(totalAllMoney));
      }
      
      // Điền tổng tiền bằng chữ vào Sheet 1 và Sheet 2 (Sheet 3 đã điền ở trên)
      const totalAllMoney = (totalL1 * priceL1) + (totalL2 * priceL2) + (totalL3 * priceL3);
      if (ws1) setCellValueSafe(ws1, 'C25', readMoney(totalAllMoney));
      if (ws2) setCellValueSafe(ws2, 'C13', readMoney(totalAllMoney));
      
      // Tải xuống file xuất
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bang_Tien_${currentMonthYear || 'ThongKe'}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Lỗi xuất file: " + err.message);
    } finally {
      showLoading(false);
    }
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
        
        // Cập nhật bảng thống kê nếu đang ở tab đó
        if (document.getElementById('tab-thongke').classList.contains('active')) {
          renderThongKeTable();
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

let saveThuThuatTimeout = null;

function triggerAutoSaveThuThuat() {
  updateSyncStatus('saving');
  clearTimeout(saveThuThuatTimeout);

  // Đợi 2 giây sau lần gõ cuối mới lưu để tránh spam request
  saveThuThuatTimeout = setTimeout(() => {
    saveThuThuatToServer();
  }, 2000);
}

function saveThuThuatToServer() {
  if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes('ĐIỀN_URL_WEB_APP')) {
    updateSyncStatus('error');
    return;
  }

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

// --- TỔNG QUAN (DASHBOARD CHARTS) ---
let chartChamCongInstance = null;
let chartThuThuatInstance = null;

function renderDashboard() {
  if (typeof Chart === 'undefined') return;

  const labels = [];
  const congData = [];
  const ttData = [];

  const shortenName = (fullName) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return parts.slice(-2).join(' ');
  };

  // Lọc ra danh sách nhân viên có dữ liệu (có công hoặc có thủ thuật)
  employees.forEach(emp => {
    let tongCong = 0;
    const cc = chamCongData[emp] || {};
    Object.values(cc).forEach(val => {
      if (val === 'sang' || val === 'chieu') tongCong += 0.5;
      else if (val === 'ca-ngay') tongCong += 1;
    });

    const tt = thuThuatData[emp] || { loai1: 0, loai2: 0, loai3: 0 };
    const tongTT = (tt.loai1 || 0) + (tt.loai2 || 0) + (tt.loai3 || 0);

    if (tongCong > 0 || tongTT > 0) {
      labels.push(shortenName(emp));
      congData.push(tongCong);
      ttData.push(tongTT);
    }
  });

  // Chart Chấm Công
  const ctxCong = document.getElementById('chartChamCong');
  if (ctxCong) {
    if (chartChamCongInstance) chartChamCongInstance.destroy();
    chartChamCongInstance = new Chart(ctxCong.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ngày công',
          data: congData,
          backgroundColor: '#4cc9f0',
          borderColor: '#4895ef',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Chart Thủ Thuật
  const ctxTT = document.getElementById('chartThuThuat');
  if (ctxTT) {
    if (chartThuThuatInstance) chartThuThuatInstance.destroy();
    chartThuThuatInstance = new Chart(ctxTT.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Thủ thuật',
          data: ttData,
          backgroundColor: '#f72585',
          borderColor: '#b5179e',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

// --- CÀI ĐẶT (SAO LƯU / KHÔI PHỤC NÂNG CAO) ---
document.addEventListener('DOMContentLoaded', () => {
  const btnBackup = document.getElementById('btn-backup-data');
  if (btnBackup) {
    btnBackup.addEventListener('click', async () => {
      const type = document.getElementById('backup-type').value;
      if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes('ĐIỀN_URL_WEB_APP')) {
        alert("Vui lòng cấu hình URL Web App trước khi sao lưu!");
        return;
      }

      showLoading(true);
      let monthsToFetch = [];
      let currentY = parseInt(document.getElementById('year-picker').value);
      let currentM = parseInt(document.getElementById('month-picker').value);

      if (type === 'thang') {
        monthsToFetch.push(`${currentY}-${String(currentM).padStart(2, '0')}`);
      } else if (type === 'quy') {
        let q = Math.ceil(currentM / 3);
        let startM = (q - 1) * 3 + 1;
        for (let i = 0; i < 3; i++) monthsToFetch.push(`${currentY}-${String(startM + i).padStart(2, '0')}`);
      } else if (type === 'nam') {
        for (let i = 1; i <= 12; i++) monthsToFetch.push(`${currentY}-${String(i).padStart(2, '0')}`);
      } else if (type === 'all') {
        const thisYear = new Date().getFullYear();
        for (let y = 2024; y <= Math.max(thisYear, currentY); y++) {
          for (let i = 1; i <= 12; i++) monthsToFetch.push(`${y}-${String(i).padStart(2, '0')}`);
        }
      }

      let finalData = { version: "2.0", type: type, timestamp: new Date().toISOString(), employees: employees, data: {} };

      try {
        // Tải dữ liệu theo batch (mỗi lần 3 tháng để tránh lỗi)
        for (let i = 0; i < monthsToFetch.length; i += 3) {
          const batch = monthsToFetch.slice(i, i + 3);
          const promises = batch.map(m => 
            fetch(`${GAS_WEBAPP_URL}?action=getAllData&monthYear=${m}`, { redirect: 'follow' })
              .then(res => res.json())
              .then(res => {
                if (res.status === 'success') {
                  finalData.data[m] = {
                    chamCongData: res.data.chamcong || {},
                    thuThuatData: res.data.thuthuat || {}
                  };
                }
              }).catch(e => console.error(e))
          );
          await Promise.all(promises);
        }

        const jsonStr = JSON.stringify(finalData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Backup_${type}_${new Date().getTime()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast("Sao lưu dữ liệu thành công!");
      } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra khi tải dữ liệu từ máy chủ.");
      } finally {
        showLoading(false);
      }
    });
  }

  const fileInputRestore = document.getElementById('restore-file-input');
  if (fileInputRestore) {
    fileInputRestore.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsedData = JSON.parse(event.target.result);
          
          if (!parsedData.data && !parsedData.chamCongData) {
            alert("File không đúng định dạng sao lưu của hệ thống!");
            return;
          }

          if (!confirm("Hệ thống sẽ tải toàn bộ dữ liệu từ file này lên Máy Chủ. Bạn có chắc chắn không?")) {
            e.target.value = '';
            return;
          }

          showLoading(true);

          if (parsedData.employees && Array.isArray(parsedData.employees)) {
            employees = [...new Set([...employees, ...parsedData.employees])];
            saveEmployeesLocally();
          }

          // Xử lý cả định dạng cũ (version 1.0) và mới (version 2.0)
          if (parsedData.version === "2.0") {
            const months = Object.keys(parsedData.data);
            for (let i = 0; i < months.length; i++) {
              const m = months[i];
              const mData = parsedData.data[m];
              
              // Cập nhật lên máy chủ tuần tự
              await fetch(GAS_WEBAPP_URL, {
                method: 'POST', body: JSON.stringify({ action: 'saveChamCong', monthYear: m, data: mData.chamCongData })
              });
              await fetch(GAS_WEBAPP_URL, {
                method: 'POST', body: JSON.stringify({ action: 'saveThuThuat', monthYear: m, data: mData.thuThuatData })
              });

              // Cập nhật bộ nhớ cục bộ nếu là tháng hiện tại
              if (m === currentMonthYear) {
                chamCongData = mData.chamCongData;
                thuThuatData = mData.thuThuatData;
              }
            }
          } else {
            // Định dạng cũ (v1)
            chamCongData = parsedData.chamCongData;
            thuThuatData = parsedData.thuThuatData || {};
            await fetch(GAS_WEBAPP_URL, {
              method: 'POST', body: JSON.stringify({ action: 'saveChamCong', monthYear: currentMonthYear, data: chamCongData })
            });
            await fetch(GAS_WEBAPP_URL, {
              method: 'POST', body: JSON.stringify({ action: 'saveThuThuat', monthYear: currentMonthYear, data: thuThuatData })
            });
          }

          renderEmployeesTable();
          renderChamCongTable();
          if (document.getElementById('tab-thongke').classList.contains('active')) renderThongKeTable();
          if (document.getElementById('tab-tongquan').classList.contains('active')) renderDashboard();

          showToast("Khôi phục toàn bộ dữ liệu thành công!");
        } catch (err) {
          console.error(err);
          alert("Lỗi khi đọc và khôi phục file!");
        } finally {
          showLoading(false);
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    });
  }
});
