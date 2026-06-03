# Hướng Dẫn Cài Đặt Hệ Thống Chấm Công & Thủ Thuật

## 1. Triển Khai Server-side (Google Apps Script & Google Drive)

**Bước 1: Tạo thư mục lưu trữ trên Google Drive**
1. Mở [Google Drive](https://drive.google.com).
2. Tạo một thư mục mới có tên là `Data_ChamCong_ThuThuat`.
3. Mở thư mục đó ra, nhìn lên thanh địa chỉ URL của trình duyệt, hãy **copy phần ID của thư mục**.
   *(Ví dụ: URL là `https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9I0j` thì ID sẽ là `1A2b3C4d5E6f7G8h9I0j`)*.

**Bước 2: Tạo Web App bằng Google Apps Script**
1. Truy cập [Google Apps Script](https://script.google.com/).
2. Bấm **"New Project"** (Dự án mới).
3. Đổi tên dự án thành "API Quản Lý Chấm Công".
4. Copy toàn bộ nội dung của file `Code.gs` đã được tôi viết sẵn và dán đè vào file `Code.gs` (hoặc `Mã.gs`) trên màn hình soạn thảo.
5. Tìm dòng số 5 ở đầu file và thay thế bằng ID thư mục bạn vừa copy:
   `const FOLDER_ID = 'ĐIỀN_ID_THƯ_MỤC_CỦA_BẠN_VÀO_ĐÂY';`
6. Bấm nút **Lưu** (biểu tượng đĩa mềm hoặc phím tắt `Ctrl + S`).

**Bước 3: Deploy (Triển khai) làm Web App**
1. Bấm nút màu xanh **"Deploy"** (Triển khai) ở góc trên bên phải -> Chọn **"New deployment"** (Triển khai mới).
2. Ở biểu tượng bánh răng bên cạnh chữ "Select type" (Chọn loại), đánh dấu check vào **"Web app"**.
3. Cấu hình triển khai:
   - Description (Mô tả): `API_v1`
   - **Execute as (Thực thi dưới quyền): Chọn "Me (Email của bạn)"** *(Bắt buộc để code tự động lưu vào Drive của bạn).*
   - **Who has access (Ai có quyền truy cập): Chọn "Anyone"** (Bất kỳ ai) *(Bắt buộc để code từ Vercel có thể gọi sang API này mà không bị chặn).*
4. Bấm **"Deploy"**. 
5. *(Lưu ý: Lần đầu tiên, Google sẽ yêu cầu bạn xác thực Cấp Quyền "Authorize access". Bạn chọn tài khoản email -> chọn "Advanced" (Nâng cao) ở góc trái dưới cùng -> chọn "Go to Project... (unsafe)" -> Bấm Allow (Cho phép)).*
6. Sau khi Deploy thành công, một bảng hiển thị ra. Hãy **Copy "Web app URL"** (Bắt đầu bằng `https://script.google.com/macros/s/.../exec`).

---

## 2. Thiết Lập Client-side (Đẩy lên Vercel)

**Bước 1: Điền Web App URL vào code JavaScript**
1. Mở file `script.js`.
2. Tìm dòng 5:
   `const GAS_WEBAPP_URL = 'ĐIỀN_URL_WEB_APP_CỦA_BẠN_VÀO_ĐÂY';`
3. Dán đường link URL bạn vừa copy ở Google Apps Script vào giữa 2 dấu nháy đơn. Lưu file lại.

**Bước 2: Triển khai lên Vercel**
1. Tải toàn bộ 3 file (`index.html`, `style.css`, `script.js`) lên một repository mới trên tài khoản GitHub của bạn.
2. Đăng nhập vào [Vercel](https://vercel.com/) bằng tài khoản GitHub.
3. Chọn **Add New...** -> **Project**.
4. Chọn Import Repository bạn vừa tạo trên GitHub.
5. Để nguyên các cài đặt mặc định và bấm **Deploy**.
6. Sau vài chục giây, Vercel sẽ cấp cho bạn một đường dẫn domain công khai để truy cập ứng dụng.

---

## 3. Cách Sử Dụng Ứng Dụng
1. **Quản lý danh sách nhân viên:** Chuyển sang Tab "Danh Sách Nhân Viên" để Thêm/Xóa các nhân viên trong khoa. Danh sách này lưu cục bộ trên máy tính trình duyệt của bạn để tiện lợi, nhưng sẽ dùng chung cho toàn bộ web.
2. **Chấm công:** Chọn "Tháng/Năm" bạn muốn chấm. Chọn ca (Sáng/Chiều/Cả Ngày) cho từng nhân viên. Hệ thống sẽ **Tự Động Lưu** mỗi khi bạn thay đổi (có Delay 2 giây để tối ưu máy chủ Google). Không cần nút Lưu.
3. **Thủ thuật:** Chuyển sang Tab "Tải File Thủ Thuật", chọn Excel để tải lên. Xác nhận dữ liệu hiển thị đúng rồi bấm **Gửi lên bộ nhớ** để lưu vào file của tháng đó trên Drive. (File Excel mẫu phải có tên cột trùng khớp như code).
4. **Thống kê:** Chuyển sang tab thống kê để xem tổng hợp công và thủ thuật của toàn bộ nhân viên. Bấm nút **Xuất Báo Cáo** để tải file Excel về.
