ALTER TABLE products ADD COLUMN name_vi TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN description_vi TEXT NOT NULL DEFAULT '';
UPDATE products SET name_vi = CASE sku
  WHEN 'FX-U-TEE' THEN 'Áo thun Motion'
  WHEN 'FX-U-JOG' THEN 'Quần jogger Flex'
  WHEN 'FX-U-HOD' THEN 'Áo hoodie Gusset'
  WHEN 'FX-U-SHO' THEN 'Quần short co giãn'
  WHEN 'FX-U-JKT' THEN 'Áo khoác Articulated'
  WHEN 'FX-U-BSL' THEN 'Áo giữ nhiệt đường may phẳng'
  WHEN 'FX-M-TEE' THEN 'Áo thun Motion nam'
  WHEN 'FX-M-HOD' THEN 'Áo hoodie Gusset nam'
  WHEN 'FX-M-BSL' THEN 'Áo giữ nhiệt nam'
  WHEN 'FX-M-JOG' THEN 'Quần jogger Flex nam'
  WHEN 'FX-M-SHO' THEN 'Quần short co giãn nam'
  WHEN 'FX-M-JKT' THEN 'Áo khoác Articulated nam'
  WHEN 'FX-W-TEE' THEN 'Áo thun Motion nữ'
  WHEN 'FX-W-HOD' THEN 'Áo hoodie Gusset nữ'
  WHEN 'FX-W-BSL' THEN 'Áo giữ nhiệt nữ'
  WHEN 'FX-W-LEG' THEN 'Quần legging Flex nữ'
  WHEN 'FX-W-SHO' THEN 'Quần short co giãn nữ'
  WHEN 'FX-W-JKT' THEN 'Áo khoác Flex Wrap nữ'
  WHEN 'FX-K-TEE' THEN 'Áo thun Mini Motion trẻ em'
  WHEN 'FX-K-BSL' THEN 'Áo giữ nhiệt trẻ em'
  WHEN 'FX-K-JOG' THEN 'Quần jogger Flex trẻ em'
  WHEN 'FX-K-SHO' THEN 'Quần short co giãn trẻ em'
  WHEN 'FX-K-JKT' THEN 'Áo khoác gấp gọn trẻ em'
  ELSE name_vi END,
  description = CASE category
    WHEN 'Tops' THEN 'Performance top designed for comfortable movement and everyday training.'
    WHEN 'Bottoms' THEN 'Flexible everyday bottoms made to move comfortably through training and recovery.'
    WHEN 'Outerwear' THEN 'Lightweight performance outerwear designed for movement and changing weather.'
    ELSE description END,
  description_vi = CASE category
    WHEN 'Tops' THEN 'Áo thể thao linh hoạt, thoải mái khi vận động và phù hợp để mặc hằng ngày.'
    WHEN 'Bottoms' THEN 'Trang phục mặc dưới co giãn linh hoạt, phù hợp khi tập luyện và nghỉ ngơi.'
    WHEN 'Outerwear' THEN 'Áo khoác thể thao nhẹ, linh hoạt khi vận động và thích hợp với thời tiết thay đổi.'
    ELSE description_vi END
WHERE sku LIKE 'FX-%';
