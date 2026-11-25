-- Thêm size cho sản phẩm và lưu size khách chọn trong từng đơn hàng.
CREATE TABLE IF NOT EXISTS product_sizes (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, size)
);
CREATE INDEX IF NOT EXISTS idx_product_sizes_size ON product_sizes(size, product_id);
ALTER TABLE order_items ADD COLUMN size TEXT NOT NULL DEFAULT '';

-- Khởi tạo size bằng VALUES để tương thích giới hạn compound SELECT của D1.
WITH sizes(size, position, group_name) AS (
  VALUES
    ('XS',0,'adult_upper'),('S',1,'adult_upper'),('M',2,'adult_upper'),('L',3,'adult_upper'),('XL',4,'adult_upper'),('XXL',5,'adult_upper'),
    ('28',0,'adult_bottom'),('30',1,'adult_bottom'),('32',2,'adult_bottom'),('34',3,'adult_bottom'),('36',4,'adult_bottom'),('38',5,'adult_bottom'),
    ('2Y',0,'kids'),('4Y',1,'kids'),('6Y',2,'kids'),('8Y',3,'kids'),('10Y',4,'kids'),('12Y',5,'kids'),('14Y',6,'kids')
)
INSERT OR IGNORE INTO product_sizes (product_id, size, position)
SELECT p.id, s.size, s.position
FROM products p JOIN sizes s ON (
  (s.group_name='adult_upper' AND p.department IN ('Men','Women','Unisex') AND p.category IN ('Tops','Outerwear')) OR
  (s.group_name='adult_bottom' AND p.department IN ('Men','Women','Unisex') AND p.category='Bottoms') OR
  (s.group_name='kids' AND p.department='Kids')
);

-- Bỏ hẳn dữ liệu biến thể màu khỏi danh mục sản phẩm.
DROP TABLE IF EXISTS product_colors;
ALTER TABLE products DROP COLUMN color;
