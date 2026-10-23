# Minh Dokkai — Từ vựng tiếng Nhật theo cụm

Website tĩnh (HTML, CSS, JavaScript thuần), không cần build. Chỉ chức năng đăng nhập đồng bộ nhiều thiết bị cần thêm một cơ sở dữ liệu (xem phần dưới); không bật thì web vẫn chạy đầy đủ.

## Đưa lên mạng

Vercel: vào vercel.com, chọn "Add New → Project", kéo thả cả thư mục `minh-dokkai` (hoặc đẩy lên GitHub rồi import). Không cần cấu hình gì thêm, Framework chọn "Other".

Netlify: vào app.netlify.com/drop và kéo thả thư mục.

Chạy thử trên máy: mở terminal trong thư mục và gõ `python3 -m http.server`, rồi vào http://localhost:8000.

## Cấu trúc thư mục

```
index.html            khung trang
assets/style.css      giao diện (bảng màu ở đầu file)
assets/app.js         toàn bộ chức năng học, test đầu vào, vuốt thẻ
assets/auth.js        tài khoản và đồng bộ tiến độ (phía trình duyệt)
api/auth.js           đăng ký, đăng nhập (Vercel Function)
api/progress.js       lưu và đọc tiến độ theo tài khoản (Vercel Function)
api/_lib.js           hàm dùng chung cho api
assets/logo-mark.svg  biểu tượng logo
data/catalog.js       danh sách cấp độ, chủ đề dự kiến, từ loại, 10 ngành
data/n5.js            dữ liệu N5 (sinh tự động, không sửa tay)
source/n5/t01.txt…    dữ liệu gốc, sửa ở đây
tools/build.py        biên dịch source/ thành data/
tools/report.txt      báo cáo kiểm tra sau mỗi lần biên dịch
```

## Sửa hoặc thêm từ

Mỗi dòng trong `source/<cấp>/tXX.txt` là một mục, gồm 8 ô cách nhau bằng ` | `:

```
từ | từ loại | Hán Việt | nghĩa | cụm từ | nghĩa cụm | câu ví dụ | dịch ví dụ
経済[けいざい] | n | KINH TẾ | kinh tế | 経済[けいざい] が 成長[せいちょう] する | kinh tế tăng trưởng | … | …
```

Kanji luôn kèm cách đọc trong ngoặc vuông ngay sau nó: `食[た]べる`. Trong cụm từ, các khối cách nhau bằng dấu cách để romaji được ngắt từ đúng; dấu cách tự bị bỏ khi hiển thị tiếng Nhật. Dấu `{…}` đánh dấu từ chính trong cụm (để trống thì công cụ tự tìm). Ô không có nội dung ghi `-`.

Mã từ loại: n, pron, q, v1, v2, v3, adj-i, adj-na, adv, conj, ctr, num, exp, interj, pref, suf. Một từ có nhiều loại thì nối bằng dấu phẩy, ví dụ `n,v3`.

Sau khi sửa, chạy `python3 tools/build.py`. Công cụ báo lỗi nếu thiếu cách đọc, thiếu Hán Việt, sai số cột hoặc trùng mục, và liệt kê các cách đọc khác với gợi ý của máy trong `tools/report.txt` để soát lại (gợi ý máy thường sai với từ thuần Nhật, nên chỉ dùng để tham khảo). Cài thêm `pip install pykakasi` để bật phần gợi ý này.

## Mở thêm cấp độ

Tạo thư mục `source/n4/` với các file `t01.txt`, `t02.txt`… (dòng đầu file gồm `@topic`, `@ja`, `@vi`, `@desc` như file N5), chạy build, rồi trong `data/catalog.js` đổi `ready: false` thành `ready: true` cho cấp đó. Gói chuyên ngành sẽ dùng cùng định dạng.

## Tiến độ học

Lưu trong trình duyệt của từng người (localStorage), không cần đăng nhập. Xóa dữ liệu trình duyệt thì tiến độ mất.

## Bật tài khoản đồng bộ trên Vercel (làm một lần, khoảng 3 phút)

Nếu bỏ qua phần này, nút Đăng nhập vẫn hoạt động ở "chế độ trên thiết bị": tài khoản và tiến độ chỉ nằm trong trình duyệt đó, không sang máy khác được.

1. Trong dự án trên Vercel, vào Storage (hoặc Marketplace), thêm "Upstash Redis" (gói miễn phí đủ dùng) và nối vào dự án. Vercel tự thêm biến `KV_REST_API_URL` và `KV_REST_API_TOKEN`.
2. Vào Settings, Environment Variables, thêm `AUTH_SECRET` với một chuỗi ngẫu nhiên dài (ví dụ kết quả của `openssl rand -hex 32`). Đừng đổi sau này, nếu đổi thì mọi người phải đăng nhập lại.
3. Deploy lại. Mở web, bấm Đăng nhập: hộp thoại không còn dòng "Chế độ trên thiết bị" là đã chạy bằng máy chủ.

Lưu ý: mật khẩu được băm bằng scrypt, đăng nhập sai quá 10 lần trong 15 phút sẽ bị khóa tạm. Hiện chưa có quên mật khẩu qua email. Tiến độ trên các máy được gộp theo thời điểm đánh dấu từng từ, nên học trên điện thoại rồi đăng nhập trên máy tính sẽ không mất gì.

## Test trình độ đầu vào

Trang `#/test`: 5 phần N5 đến N1, mỗi phần 8 câu lấy ngẫu nhiên từ kho từ (nghĩa của từ, điền từ vào cụm, cách đọc Kanji), tối đa 40 câu và 15 phút. Phần nào đúng dưới 50% thì dừng. Đúng từ 75% là vững cấp đó. Các mốc nằm ở đầu khối `PL` trong `assets/app.js`.
