// Cấu hình ID thư mục Google Drive của bạn
// Tạo 1 thư mục trên Google Drive, mở thư mục đó ra và copy chuỗi ID trên thanh địa chỉ URL.
// Ví dụ URL: https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9I0j
// ID sẽ là: 1A2b3C4d5E6f7G8h9I0j
const FOLDER_ID = '1jhj-8FO-94BFL8xKDW6vk4XmCmPEc6c4';

function doGet(e) {
  const action = e.parameter.action;
  const monthYear = e.parameter.monthYear; // VD: "2023-10"
  
  if (action === 'getChamCong') {
    const data = getFileContent(`chamcong_${monthYear}.json`);
    return createJsonResponse({status: 'success', data: data});
  }
  
  if (action === 'getThuThuat') {
    const data = getFileContent(`thuthuat_${monthYear}.json`);
    return createJsonResponse({status: 'success', data: data});
  }
  
  if (action === 'getAllData') {
    const chamcong = getFileContent(`chamcong_${monthYear}.json`);
    const thuthuat = getFileContent(`thuthuat_${monthYear}.json`);
    return createJsonResponse({status: 'success', data: { chamcong: chamcong, thuthuat: thuthuat }});
  }
  
  return createJsonResponse({status: 'error', message: 'Invalid GET action'});
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const monthYear = postData.monthYear;
    
    if (action === 'saveChamCong') {
      saveFileContent(`chamcong_${monthYear}.json`, postData.data);
      return createJsonResponse({status: 'success', message: 'Đã lưu chấm công'});
    }
    
    if (action === 'saveThuThuat') {
      saveFileContent(`thuthuat_${monthYear}.json`, postData.data);
      return createJsonResponse({status: 'success', message: 'Đã lưu thủ thuật'});
    }
    
    return createJsonResponse({status: 'error', message: 'Invalid POST action'});
  } catch (err) {
    return createJsonResponse({status: 'error', message: err.toString()});
  }
}

// Hàm hỗ trợ trả về JSON
function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}

// Đọc nội dung file JSON từ Google Drive
function getFileContent(fileName) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files = folder.getFilesByName(fileName);
    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      return JSON.parse(content);
    }
    return {}; // Trả về object rỗng nếu file chưa tồn tại
  } catch (e) {
    return {};
  }
}

// Lưu nội dung JSON vào Google Drive
function saveFileContent(fileName, data) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFilesByName(fileName);
  const jsonString = JSON.stringify(data);
  
  if (files.hasNext()) {
    // Cập nhật file hiện tại
    const file = files.next();
    file.setContent(jsonString);
  } else {
    // Tạo file mới
    folder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);
  }
}
