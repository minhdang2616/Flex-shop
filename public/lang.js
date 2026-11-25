(function () {
  'use strict';
  var vi = {
    'active':'Đang hoạt động','draft':'Bản nháp','disabled':'Đã khóa','pending':'Chờ xử lý','shipped':'Đang giao','delivered':'Đã giao','cancelled':'Đã hủy','paid':'Đã thanh toán','refunded':'Đã hoàn tiền','customer':'Khách hàng','staff':'Nhân viên','admin':'Quản trị viên','new':'Mới','read':'Đã đọc','all':'Tất cả','locked':'Đã khóa',
    'Tag':'Nhãn sản phẩm','Color':'Màu sắc','Bestseller':'Bán chạy','Unisex':'Unisex','SKU (optional)':'SKU (không bắt buộc)','Add product':'Thêm sản phẩm','Edit product':'Sửa sản phẩm','Create user':'Tạo người dùng','Edit user':'Sửa người dùng','All':'Tất cả','Pending':'Chờ xử lý','Shipped':'Đang giao','Delivered':'Đã giao','Cancelled':'Đã hủy','Never':'Chưa từng',
    'Request failed':'Yêu cầu không thành công','Upload failed':'Tải ảnh lên không thành công','Product added':'Đã thêm sản phẩm','Product updated':'Đã cập nhật sản phẩm','Product deleted':'Đã xóa sản phẩm','User created':'Đã tạo người dùng','User updated':'Đã cập nhật người dùng','Drop scheduled':'Đã lên lịch ra mắt','Drop updated':'Đã cập nhật sản phẩm ra mắt','Drop removed':'Đã xóa sản phẩm ra mắt','Payment status updated':'Đã cập nhật trạng thái thanh toán','Cover photo updated':'Đã cập nhật ảnh bìa','Photo uploaded':'Đã tải ảnh lên','photos uploaded':'ảnh đã được tải lên','No activity yet.':'Chưa có hoạt động.','No photos yet. Upload one below.':'Chưa có ảnh. Tải ảnh lên bên dưới.','No shipping address on file.':'Chưa có địa chỉ giao hàng.','cash on delivery':'Thanh toán khi nhận hàng','locked':'Đã khóa',
    'Join Us':'Tham gia','Sign In':'Đăng nhập','Sign Out':'Đăng xuất','New & Featured':'Mới & Nổi bật','Men':'Nam','Women':'Nữ','Kids':'Trẻ em','Upcoming':'Sắp ra mắt','Sale':'Giảm giá',
    'Shop by Category':'Mua theo danh mục','Tops':'Áo','Bottoms':'Quần','Outerwear':'Áo khoác',"Shop All Men's":'Xem tất cả đồ nam',"Shop All Women's":'Xem tất cả đồ nữ',"Shop All Kids'":'Xem tất cả đồ trẻ em',
    'Featured':'Nổi bật','New Arrivals':'Hàng mới về','Bestsellers':'Bán chạy','Search':'Tìm kiếm','Account':'Tài khoản','Open menu':'Mở menu',
    'Free Standard Delivery & 30-Day Free Returns':'Miễn phí giao hàng tiêu chuẩn và đổi trả trong 30 ngày','Join Now':'Tham gia ngay','View Details':'Xem chi tiết','Home':'Trang chủ',
    'Shop the collection':'Mua sắm bộ sưu tập','Built to':'Thiết kế để','move first.':'chuyển động.','4-Way Stretch':'Co giãn bốn chiều','Gusseted Seams':'Đường may gia cố','Flat-Seam Build':'Đường may phẳng','Tested to 10K Reps':'Đã thử nghiệm 10.000 lần',
    "How it's made":'Cách sản phẩm được tạo ra','Four-way stretch':'Co giãn bốn chiều','Gusseted seams':'Đường may gia cố','Articulated cut':'Phom dáng linh hoạt','Flat, low-bulk seams':'Đường may phẳng, gọn nhẹ',
    'Get in touch':'Liên hệ với chúng tôi','Name':'Họ tên','Email':'Email','Message':'Tin nhắn','Send message':'Gửi tin nhắn','Built to move.':'Sẵn sàng chuyển động.',
    'Log in':'Đăng nhập','Your account':'Tài khoản của bạn','Sign out':'Đăng xuất','Username':'Tên đăng nhập','Password':'Mật khẩu',"Don't have an account?":'Chưa có tài khoản?','Create one':'Tạo tài khoản','Quick sign-in / sign-up':'Đăng nhập / đăng ký nhanh','Continue with Google':'Tiếp tục với Google',
    'Your bag':'Giỏ hàng','Close':'Đóng','Your bag is empty.':'Giỏ hàng đang trống.','Subtotal':'Tạm tính','Checkout':'Thanh toán','Add to bag':'Thêm vào giỏ','Added':'Đã thêm','Max in bag':'Đã đạt số lượng tối đa',
    'Loading...':'Đang tải...','Loading':'Đang tải','New pieces coming soon.':'Sản phẩm mới sẽ sớm ra mắt.','We could not load products. Please refresh.':'Không tải được sản phẩm. Vui lòng tải lại trang.',
    'Sort by':'Sắp xếp theo','Newest':'Mới nhất','Price: low to high':'Giá: thấp đến cao','Price: high to low':'Giá: cao đến thấp','Name: A to Z':'Tên: A đến Z',
    "Men's gear.":'Nam',"Women's gear.":'Nữ',"Kids' gear.":'Trẻ em','Create your account':'Tạo tài khoản','Join Flex to keep your bag, check out faster and hear about new drops first.':'Tham gia Flex để lưu giỏ hàng, thanh toán nhanh và cập nhật bộ sưu tập mới.',
    'Sign up with Google':'Đăng ký bằng Google','or create an account with a password':'hoặc tạo tài khoản bằng mật khẩu','Full name':'Họ và tên','Phone number':'Số điện thoại','Country':'Quốc gia','Address':'Địa chỉ','City':'Thành phố','Postal code':'Mã bưu chính','At least 8 characters.':'Ít nhất 8 ký tự.','Confirm password':'Xác nhận mật khẩu','Create account':'Tạo tài khoản','Already have an account?':'Đã có tài khoản?',
    'Almost there':'Sắp xong rồi','Taken from your Google account.':'Lấy từ tài khoản Google của bạn.','Finish sign-up':'Hoàn tất đăng ký','Change password':'Đổi mật khẩu','Current password':'Mật khẩu hiện tại','New password':'Mật khẩu mới','Confirm new password':'Xác nhận mật khẩu mới','Save new password':'Lưu mật khẩu mới',
    'Send code to my email':'Gửi mã đến email của tôi','Email verification code':'Mã xác minh email','My orders':'Đơn hàng của tôi','Edit profile & delivery':'Sửa hồ sơ và địa chỉ giao hàng','Your orders':'Đơn hàng của bạn','Profile & delivery':'Hồ sơ và giao hàng','Cancel order':'Hủy đơn hàng','Remove':'Xóa','Sending...':'Đang gửi...','Loading…':'Đang tải…','Saving…':'Đang lưu…','Updating password…':'Đang cập nhật mật khẩu…',
    'Sort by':'Sắp xếp theo','Language':'Ngôn ngữ','Home':'Trang chủ','Search products':'Tìm sản phẩm','Search results.':'Kết quả tìm kiếm.','Searching...':'Đang tìm kiếm...',
    'Upcoming drops.':'Sản phẩm sắp ra mắt.','What\'s coming next, and when. Get notified the morning it lands.':'Sắp có gì mới và khi nào ra mắt? Đăng ký để nhận thông báo ngay khi sản phẩm lên kệ.',
    'Cut with a slight pre-bend at the knee and shoulder, so nothing pulls mid-stride or mid-reach.':'Thiết kế cong nhẹ ở đầu gối và vai để trang phục không bị căng khi bạn sải bước hay vươn người.',
    'The same stretch and gusseted-seam construction, sized down for a kid who won\'t sit still.':'Chất vải co giãn và đường may gia cố, với kích cỡ dành cho các bé luôn năng động.',
    'Only':'Chỉ còn','left':'sản phẩm','In stock':'Còn hàng','Sold out':'Hết hàng','Notify me':'Thông báo cho tôi','Drops':'Ra mắt','You\'re on the list':'Đã đăng ký nhận tin',
    'result':'kết quả','results':'kết quả','New pieces coming soon.':'Sản phẩm mới sẽ sớm ra mắt.','Back to the shop':'Quay lại cửa hàng',
    'Please log in to add items to your bag.':'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.','Please log in to get notified when this drops.':'Vui lòng đăng nhập để nhận thông báo khi sản phẩm ra mắt.',
    'Message saved. The shop can review it in the Messages page.':'Đã lưu tin nhắn. Shop có thể xem trong mục Tin nhắn.',
    'Your session ended. Please log in again.':'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
    'Four-way stretch fabric and gusseted seams, engineered for a body in motion — not a mannequin standing still.':'Vải co giãn bốn chiều và đường may gia cố, thiết kế cho cơ thể luôn vận động.',
    'Order questions, sizing help, or a return — the team replies within one business day.':'Cần hỗ trợ đơn hàng, chọn cỡ hoặc đổi trả? Đội ngũ sẽ phản hồi trong một ngày làm việc.',
    'Stretch tops, leggings and outerwear designed to move with you.':'Áo co giãn, quần legging và áo khoác đồng hành cùng mọi chuyển động.',
    'Comfortable everyday gear for the next generation of movers.':'Trang phục thoải mái hằng ngày cho thế hệ năng động.',
    'Stretch tees, joggers and outerwear built around how a body actually bends, reaches and runs.':'Áo thun co giãn, quần jogger và áo khoác thiết kế theo chuyển động tự nhiên của cơ thể.',
    'Only':'Chỉ còn','No drops scheduled right now. Check back soon.':'Hiện chưa có sản phẩm nào sắp ra mắt. Hãy quay lại sau.',
    'We could not load upcoming drops.':'Không tải được danh sách sản phẩm sắp ra mắt.','We could not find that product.':'Không tìm thấy sản phẩm này.',
    'Please refresh.':'Vui lòng tải lại trang.','Sending verification code…':'Đang gửi mã xác minh…','Code sent to your Google account email. It expires in 10 minutes.':'Đã gửi mã đến email Google của bạn. Mã hết hạn sau 10 phút.',
    'Password updated. Other signed-in devices have been signed out.':'Đã đổi mật khẩu. Các thiết bị khác đã đăng xuất.','Profile saved.':'Đã lưu hồ sơ.','Please wait...':'Vui lòng chờ...',
    'Find a Store':'Tìm cửa hàng','Help':'Trợ giúp','Men — Flex':'Nam — Flex','Women — Flex':'Nữ — Flex','Kids — Flex':'Trẻ em — Flex','Product — Flex':'Sản phẩm — Flex','Upcoming Drops — Flex':'Sản phẩm sắp ra mắt — Flex','Search — Flex':'Tìm kiếm — Flex','Create account — Flex':'Tạo tài khoản — Flex','Flex — Built to move first':'Flex — Thiết kế để chuyển động',
    'Personal information':'Thông tin cá nhân','3–30 letters, numbers, _ or . — you\'ll sign in with this.':'3–30 ký tự gồm chữ, số, _ hoặc . — dùng để đăng nhập.','You\'re already signed in.':'Bạn đã đăng nhập.','Continue shopping':'Tiếp tục mua sắm','Log in':'Đăng nhập',
    'Built to':'Thiết kế để','move first.':'chuyển động.','We design from the joint out — shoulders, hips, knees — so the fabric moves before your body has to fight it.':'Chúng tôi thiết kế theo chuyển động của vai, hông và đầu gối để vải linh hoạt theo cơ thể.',
    'Every fabric we use stretches on both grains, so a shirt or a pair of trousers moves with a reach or a lunge and returns to shape after.':'Vải co giãn theo cả hai chiều, linh hoạt theo từng chuyển động và trở lại hình dáng ban đầu.',
    'Underarms, crotch and knees get an extra panel of fabric at the seam, the same construction used in performance wear, so nothing rips at the stress point.':'Vùng nách, đáy quần và đầu gối được gia cố để hạn chế rách tại các điểm chịu lực.',
    'Sleeves and knees are cut with a slight pre-bend rather than straight, matching the natural resting angle of an arm or a leg.':'Tay áo và đầu gối được cắt theo độ cong tự nhiên của cơ thể.',
    'Seams are bonded or flat-felled where they\'d otherwise sit under a bag strap or a waistband, so nothing chafes on a long day.':'Đường may được làm phẳng ở vị trí tiếp xúc với quai túi hoặc cạp quần để giảm cọ xát.',
    'Email:':'Email:','Phone:':'Điện thoại:','Search results.':'Kết quả tìm kiếm.','Searching...':'Đang tìm kiếm...','Product':'Sản phẩm','Men':'Nam','Women':'Nữ','Kids':'Trẻ em',
    'Type something in the search box to find products.':'Nhập từ khóa vào ô tìm kiếm để tìm sản phẩm.','No products match your search. Try another word, like “jacket” or “shorts”.':'Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa khác.','New pieces coming soon.':'Sản phẩm mới sẽ sớm ra mắt.',
    'only':'chỉ còn','left':'sản phẩm','In stock':'Còn hàng','Sold out':'Hết hàng','Notify me':'Thông báo cho tôi','Drops':'Ra mắt','No drops scheduled right now. Check back soon.':'Hiện chưa có sản phẩm nào sắp ra mắt. Hãy quay lại sau.',
    'We could not load upcoming drops.':'Không tải được sản phẩm sắp ra mắt.','We could not find that product.':'Không tìm thấy sản phẩm này.','Back to the shop':'Quay lại cửa hàng','Photo':'Ảnh','Fewer':'Giảm số lượng','More':'Tăng số lượng',
    'Please log in to add items to your bag.':'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.','Please log in to view your bag.':'Vui lòng đăng nhập để xem giỏ hàng.','Please log in to check out.':'Vui lòng đăng nhập để thanh toán.','Please log in to get notified when this drops.':'Vui lòng đăng nhập để nhận thông báo khi sản phẩm ra mắt.',
    'Your session ended. Please log in again.':'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.','Sent to Flex Shop. We\'ll get back to you within a day.':'Đã gửi đến Flex Shop. Chúng tôi sẽ phản hồi trong một ngày làm việc.','Message saved. The shop can review it in the Messages page.':'Đã lưu tin nhắn. Shop có thể xem trong mục Tin nhắn.',
    'Almost there':'Sắp xong rồi','You\'re signing up with Google. Tell us a bit more to finish creating your account.':'Bạn đang đăng ký bằng Google. Hãy điền thêm thông tin để hoàn tất.','Prefer a username and password? Create a regular account':'Muốn dùng tên đăng nhập và mật khẩu? Tạo tài khoản thường.',
    'Optional: set a password now to also sign in with your username. Leave both fields blank to use Google sign-in only.':'Không bắt buộc: đặt mật khẩu để đăng nhập bằng tên người dùng. Để trống cả hai ô nếu chỉ muốn dùng Google.',
    'Verify with your current password, or request a code at your Google account email.':'Xác minh bằng mật khẩu hiện tại hoặc gửi mã đến email Google của bạn.',
    'This Google account has no password yet. Request a verification code to set one.':'Tài khoản Google này chưa có mật khẩu. Hãy yêu cầu mã xác minh để đặt mật khẩu.',
    'Code sent to your Google account email. It expires in 10 minutes.':'Đã gửi mã đến email Google của bạn. Mã hết hạn sau 10 phút.',
    'The new passwords do not match.':'Mật khẩu mới không khớp.','The two passwords do not match.':'Hai mật khẩu không khớp.','Please enter a valid email address':'Vui lòng nhập địa chỉ email hợp lệ.',
    'Your password must be at least 8 characters.':'Mật khẩu cần có ít nhất 8 ký tự.','That username is already taken':'Tên đăng nhập này đã được sử dụng.',
    'Sign in':'Đăng nhập','Staff and admin accounts only. Passwords are stored as salted hashes and cannot be viewed by anyone.':'Chỉ dành cho nhân viên và quản trị viên. Mật khẩu được mã hóa và không ai có thể xem.',
    'Dashboard':'Bảng điều khiển','Products':'Sản phẩm','Orders':'Đơn hàng','Users':'Người dùng','Upcoming drops':'Sản phẩm sắp ra mắt','Messages':'Tin nhắn','Activity log':'Nhật ký hoạt động','Toggle theme':'Đổi giao diện',
    'Revenue':'Doanh thu','Orders':'Đơn hàng','Customers':'Khách hàng','Low stock':'Sắp hết hàng','Recent orders':'Đơn hàng gần đây','No orders yet.':'Chưa có đơn hàng.','Add product':'Thêm sản phẩm','Search name, SKU or category':'Tìm tên, SKU hoặc danh mục','Search products':'Tìm sản phẩm','Department':'Bộ phận','Price':'Giá','Stock':'Tồn kho','Status':'Trạng thái','Actions':'Thao tác','Edit':'Sửa','Images':'Hình ảnh','Delete':'Xóa','Save':'Lưu','Name (English)':'Tên (tiếng Anh)','Name (Vietnamese)':'Tên (tiếng Việt)','Description (English)':'Mô tả (tiếng Anh)','Description (Vietnamese)':'Mô tả (tiếng Việt)','Category':'Danh mục','Price (USD)':'Giá (USD)','Feature on home page':'Nổi bật trên trang chủ',
    'No products yet.':'Chưa có sản phẩm.','No orders here.':'Không có đơn hàng.','Export CSV':'Xuất CSV','View':'Xem','Customer':'Khách hàng','Placed':'Ngày đặt','Items':'Sản phẩm','Total':'Tổng cộng','Manage':'Quản lý','Create user':'Tạo người dùng','Reset password':'Đặt lại mật khẩu','Delete user':'Xóa người dùng','No users.':'Không có người dùng.','Schedule drop':'Lên lịch ra mắt','Release date':'Ngày ra mắt','Notify list':'Danh sách nhận tin','Nothing scheduled.':'Chưa có lịch ra mắt.','No messages yet.':'Chưa có tin nhắn.','Reply':'Trả lời','Mark read':'Đánh dấu đã đọc','Mark unread':'Đánh dấu chưa đọc','No activity yet.':'Chưa có hoạt động.','Add user':'Thêm người dùng',
    'Find a Store':'Tìm cửa hàng','Help':'Trợ giúp','Men — Flex':'Nam — Flex','Women — Flex':'Nữ — Flex','Kids — Flex':'Trẻ em — Flex','Product — Flex':'Sản phẩm — Flex','Upcoming Drops — Flex':'Sản phẩm sắp ra mắt — Flex','Search — Flex':'Tìm kiếm — Flex','Create account — Flex':'Tạo tài khoản — Flex','Flex — Built to move first':'Flex — Thiết kế để chuyển động','Flex Admin':'Flex Quản trị',
    'Personal information':'Thông tin cá nhân','3–30 letters, numbers, _ or . — you\'ll sign in with this.':'3–30 ký tự gồm chữ, số, _ hoặc . — dùng để đăng nhập.','You\'re already signed in.':'Bạn đã đăng nhập.','Continue shopping':'Tiếp tục mua sắm',
    'Every fabric we use stretches on both grains, so a shirt or a pair of trousers moves with a reach or a lunge and returns to shape after.':'Vải co giãn theo cả hai chiều, linh hoạt theo từng chuyển động và trở lại hình dáng ban đầu.',
    'Underarms, crotch and knees get an extra panel of fabric at the seam, the same construction used in performance wear, so nothing rips at the stress point.':'Vùng nách, đáy quần và đầu gối được gia cố để hạn chế rách tại các điểm chịu lực.',
    'Sleeves and knees are cut with a slight pre-bend rather than straight, matching the natural resting angle of an arm or a leg.':'Tay áo và đầu gối được cắt theo độ cong tự nhiên của cơ thể.',
    'Seams are bonded or flat-felled where they\'d otherwise sit under a bag strap or a waistband, so nothing chafes on a long day.':'Đường may được làm phẳng ở vị trí tiếp xúc với quai túi hoặc cạp quần để giảm cọ xát.',
    'Email:':'Email:','Phone:':'Điện thoại:','Product':'Sản phẩm','only':'chỉ còn','Photo':'Ảnh','Price':'Giá','Stock':'Tồn kho',
    'Search results.':'Kết quả tìm kiếm.','Searching...':'Đang tìm kiếm...','Upcoming drops.':'Sản phẩm sắp ra mắt.','What\'s coming next, and when. Get notified the morning it lands.':'Sắp có gì mới và khi nào ra mắt? Đăng ký để nhận thông báo ngay khi sản phẩm lên kệ.',
    'Cut with a slight pre-bend at the knee and shoulder, so nothing pulls mid-stride or mid-reach.':'Thiết kế cong nhẹ ở đầu gối và vai để trang phục không bị căng khi bạn sải bước hay vươn người.',
    'The same stretch and gusseted-seam construction, sized down for a kid who won\'t sit still.':'Chất vải co giãn và đường may gia cố, với kích cỡ dành cho các bé luôn năng động.',
    'No products match your search. Try another word, like “jacket” or “shorts”.':'Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa khác.',
    'You\'re on the list':'Đã đăng ký nhận tin','Sold out':'Hết hàng','In stock':'Còn hàng','Notify me':'Thông báo cho tôi','Drops':'Ra mắt','Back to the shop':'Quay lại cửa hàng',
    'Please log in to add items to your bag.':'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.','Please log in to view your bag.':'Vui lòng đăng nhập để xem giỏ hàng.','Please log in to check out.':'Vui lòng đăng nhập để thanh toán.','Please log in to get notified when this drops.':'Vui lòng đăng nhập để nhận thông báo khi sản phẩm ra mắt.',
    'Order placed. Thank you!':'Đặt hàng thành công. Cảm ơn bạn!','Saving…':'Đang lưu…','Loading orders…':'Đang tải đơn hàng…','Save profile':'Lưu hồ sơ','Cancel order':'Hủy đơn hàng',
    'Google sign-in isn\'t set up on this site yet.':'Trang web chưa thiết lập đăng nhập Google.','Google sign-in was cancelled.':'Bạn đã hủy đăng nhập Google.','We couldn\'t sign you in with Google. Please try again.':'Không thể đăng nhập bằng Google. Vui lòng thử lại.',
    'That sign-in attempt expired. Please try again.':'Phiên đăng nhập đã hết hạn. Vui lòng thử lại.','Your Google email address is not verified, so it cannot be used here.':'Email Google của bạn chưa được xác minh nên không thể dùng tại đây.',
    'This account is disabled.':'Tài khoản này đã bị vô hiệu hóa.','This Google account is linked to a staff account and cannot be used for customer sign-in.':'Tài khoản Google này được liên kết với tài khoản nhân viên và không thể dùng để đăng nhập mua hàng.',
    'Current password is incorrect':'Mật khẩu hiện tại không đúng','Verification code is incorrect':'Mã xác minh không đúng','Verification code is invalid or expired':'Mã xác minh không hợp lệ hoặc đã hết hạn',
    'Please wait before requesting another code':'Vui lòng chờ trước khi yêu cầu mã mới','Could not send the email. Please try again later':'Không gửi được email. Vui lòng thử lại sau',
    'Your account':'Tài khoản của bạn','Signed in as':'Đã đăng nhập với tên','Order':'Đơn hàng','placed.':'đã được đặt.','Thank you!':'Cảm ơn bạn!','No orders yet.':'Bạn chưa có đơn hàng nào.',
    'Sign in':'Đăng nhập','Staff and admin accounts only. Passwords are stored as salted hashes and cannot be viewed by anyone.':'Chỉ dành cho nhân viên và quản trị viên. Mật khẩu được mã hóa và không ai có thể xem.',
    'Dashboard':'Bảng điều khiển','Products':'Sản phẩm','Orders':'Đơn hàng','Users':'Người dùng','Upcoming drops':'Sản phẩm sắp ra mắt','Messages':'Tin nhắn','Activity log':'Nhật ký hoạt động','Toggle theme':'Đổi giao diện',
    'Revenue':'Doanh thu','Customers':'Khách hàng','Low stock':'Sắp hết hàng','Recent orders':'Đơn hàng gần đây','No orders yet.':'Chưa có đơn hàng.','Add product':'Thêm sản phẩm','Search name, SKU or category':'Tìm tên, SKU hoặc danh mục',
    'Department':'Bộ phận','Status':'Trạng thái','Actions':'Thao tác','Edit':'Sửa','Images':'Hình ảnh','Delete':'Xóa','Save':'Lưu','Name (English)':'Tên (tiếng Anh)','Name (Vietnamese)':'Tên (tiếng Việt)','Description (English)':'Mô tả (tiếng Anh)','Description (Vietnamese)':'Mô tả (tiếng Việt)','Category':'Danh mục','Price (USD)':'Giá (USD)','Feature on home page':'Nổi bật trên trang chủ',
    'No products yet.':'Chưa có sản phẩm.','No orders here.':'Không có đơn hàng.','Export CSV':'Xuất CSV','View':'Xem','Customer':'Khách hàng','Placed':'Ngày đặt','Items':'Sản phẩm','Total':'Tổng cộng','Manage':'Quản lý','Create user':'Tạo người dùng','Reset password':'Đặt lại mật khẩu','No users.':'Chưa có người dùng.','Schedule drop':'Lên lịch ra mắt','Release date':'Ngày ra mắt','Notify list':'Danh sách nhận tin','Nothing scheduled.':'Chưa có lịch ra mắt.','No messages yet.':'Chưa có tin nhắn.','Reply':'Trả lời','Mark read':'Đánh dấu đã đọc','Mark unread':'Đánh dấu chưa đọc','No activity yet.':'Chưa có hoạt động.','© 2026 Flex. All rights reserved.':'© 2026 Flex. Đã đăng ký bản quyền.','You have not placed an order yet.':'Bạn chưa đặt đơn hàng nào.','items':'sản phẩm','Bag,':'Giỏ hàng,','pending':'Đang chờ xử lý','shipped':'Đang giao','delivered':'Đã giao','cancelled':'Đã hủy','Paid':'Đã thanh toán','Refunded':'Đã hoàn tiền','Active':'Đang hoạt động','Inactive':'Ngừng hoạt động','Are you sure?':'Bạn có chắc không?','This action cannot be undone.':'Thao tác này không thể hoàn tác.','Order details':'Chi tiết đơn hàng','Customer details':'Thông tin khách hàng','Save changes':'Lưu thay đổi','Cancel':'Hủy','Back':'Quay lại','Refresh':'Tải lại','Choose a department':'Chọn bộ phận','Choose a category':'Chọn danh mục','Search orders':'Tìm đơn hàng','Search users':'Tìm người dùng','Search messages':'Tìm tin nhắn','Email address':'Địa chỉ email','Created at':'Ngày tạo','Last updated':'Cập nhật lần cuối','Inventory':'Kho hàng','Product name':'Tên sản phẩm','Upload image':'Tải ảnh lên','Add image':'Thêm ảnh','Remove image':'Xóa ảnh'
  };
  var en = {};
  Object.keys(vi).forEach(function (key) { en[vi[key]] = key; });
  function translate(root, map) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node, nodes = [];
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(function (n) {
      var raw = n.nodeValue, trimmed = raw.trim();
      if (map[trimmed]) n.nodeValue = raw.replace(trimmed, map[trimmed]);
    });
    if (root.querySelectorAll) root.querySelectorAll('input[placeholder],textarea[placeholder],[aria-label]').forEach(function (el) {
      ['placeholder','aria-label'].forEach(function (attr) { var value = el.getAttribute(attr); if (value && map[value]) el.setAttribute(attr, map[value]); });
    });
    if (root.querySelectorAll) root.querySelectorAll('[data-lang-en][data-lang-vi]').forEach(function (el) {
      var localized = map === vi ? (el.getAttribute('data-lang-vi') || el.getAttribute('data-lang-en')) : el.getAttribute('data-lang-en');
      if (el.textContent !== localized) el.textContent = localized;
    });
  }
  function apply(lang) {
    var selected = lang === 'vi' ? vi : en;
    document.documentElement.lang = lang === 'vi' ? 'vi' : 'en';
    translate(document.head, selected);
    if (selected[document.title]) document.title = selected[document.title];
    translate(document.body, selected);
    try { localStorage.setItem('flex_language', lang); } catch (_) {}
  }
  document.addEventListener('DOMContentLoaded', function () {
    try {
      apply('vi');
      var observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
          record.addedNodes.forEach(function (added) {
            if (added.nodeType === Node.TEXT_NODE) {
              var trim = added.nodeValue.trim();
              if (vi[trim]) added.nodeValue = added.nodeValue.replace(trim, vi[trim]);
            } else if (added.nodeType === Node.ELEMENT_NODE) translate(added, vi);
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } finally {
      document.documentElement.classList.remove('i18n-pending');
    }
  });
})();
