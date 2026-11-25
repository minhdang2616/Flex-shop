-- Sample catalog + drops. Prices are stored as cents of VND (e.g. 105000000 = 1,050,000 ₫).
INSERT INTO products (sku,name,department,category,price_cents,stock,status,tag,featured,created_at,updated_at) VALUES
('FX-U-TEE','Motion Tee','Unisex','Tops',105000000,120,'active','',1,strftime('%s','now'),strftime('%s','now')),
('FX-U-JOG','Flex Joggers','Unisex','Bottoms',195000000,64,'active','New',1,strftime('%s','now'),strftime('%s','now')),
('FX-U-HOD','Gusset Hoodie','Unisex','Tops',240000000,9,'active','',1,strftime('%s','now'),strftime('%s','now')),
('FX-U-SHO','Stretch Shorts','Unisex','Bottoms',95000000,210,'active','Bestseller',1,strftime('%s','now'),strftime('%s','now')),
('FX-U-JKT','Articulated Jacket','Unisex','Outerwear',320000000,4,'active','New',1,strftime('%s','now'),strftime('%s','now')),
('FX-U-BSL','Flat-Seam Base Layer','Unisex','Tops',135000000,45,'active','',1,strftime('%s','now'),strftime('%s','now')),
('FX-M-TEE','Men''s Motion Tee','Men','Tops',105000000,80,'active','New',0,strftime('%s','now'),strftime('%s','now')),
('FX-M-HOD','Men''s Gusset Hoodie','Men','Tops',240000000,40,'active','',0,strftime('%s','now'),strftime('%s','now')),
('FX-M-BSL','Men''s Base Layer','Men','Tops',135000000,55,'active','',0,strftime('%s','now'),strftime('%s','now')),
('FX-M-JOG','Men''s Flex Joggers','Men','Bottoms',195000000,70,'active','Bestseller',0,strftime('%s','now'),strftime('%s','now')),
('FX-M-SHO','Men''s Stretch Shorts','Men','Bottoms',95000000,90,'active','',0,strftime('%s','now'),strftime('%s','now')),
('FX-M-JKT','Men''s Articulated Jacket','Men','Outerwear',320000000,25,'active','New',0,strftime('%s','now'),strftime('%s','now')),
('FX-W-TEE','Women''s Motion Tee','Women','Tops',105000000,85,'active','New',0,strftime('%s','now'),strftime('%s','now')),
('FX-W-HOD','Women''s Gusset Hoodie','Women','Tops',230000000,35,'active','',0,strftime('%s','now'),strftime('%s','now')),
('FX-W-BSL','Women''s Base Layer','Women','Tops',130000000,60,'active','',0,strftime('%s','now'),strftime('%s','now')),
('FX-W-LEG','Women''s Flex Leggings','Women','Bottoms',185000000,95,'active','Bestseller',0,strftime('%s','now'),strftime('%s','now')),
('FX-W-SHO','Women''s Stretch Shorts','Women','Bottoms',90000000,100,'active','',0,strftime('%s','now'),strftime('%s','now')),
('FX-W-JKT','Women''s Flex Wrap Jacket','Women','Outerwear',310000000,20,'active','New',0,strftime('%s','now'),strftime('%s','now')),
('FX-K-TEE','Mini Motion Tee','Kids','Tops',70000000,75,'active','New',0,strftime('%s','now'),strftime('%s','now')),
('FX-K-BSL','Kids'' Base Layer','Kids','Tops',85000000,50,'active','',0,strftime('%s','now'),strftime('%s','now')),
('FX-K-JOG','Kids'' Flex Joggers','Kids','Bottoms',115000000,60,'active','Bestseller',0,strftime('%s','now'),strftime('%s','now')),
('FX-K-SHO','Kids'' Stretch Shorts','Kids','Bottoms',65000000,80,'active','',0,strftime('%s','now'),strftime('%s','now')),
('FX-K-JKT','Kids'' Packable Jacket','Kids','Outerwear',170000000,30,'active','',0,strftime('%s','now'),strftime('%s','now'));

INSERT INTO drops (name,description,release_date,created_at) VALUES
('All-Weather Shell','A taped-seam shell built over the Articulated Jacket pattern, sized for layering.','Oct 14',strftime('%s','now')),
('Flex Knit Trainer','Our first footwear piece: a knit upper on a flexible sole built for lateral movement.','Oct 28',strftime('%s','now')),
('Recovery Jogger 2.0','A softer, brushed-back version of the Flex Joggers for rest days and travel.','Nov 11',strftime('%s','now')),
('Kids'' Flex Collection','An expanded Kids'' line: tops, bottoms and a packable shell in three new colors.','Dec 2',strftime('%s','now'));


-- Kich co mac dinh cho cac san pham mau.
INSERT OR IGNORE INTO product_sizes (product_id, size, position)
SELECT p.id, v.size, v.position FROM products p
JOIN (SELECT 'XS' AS size, 0 AS position UNION ALL SELECT 'S', 1 UNION ALL SELECT 'M', 2 UNION ALL SELECT 'L', 3 UNION ALL SELECT 'XL', 4 UNION ALL SELECT 'XXL', 5) v
WHERE p.department IN ('Men','Women','Unisex') AND p.category IN ('Tops','Outerwear')
UNION ALL
SELECT p.id, v.size, v.position FROM products p
JOIN (SELECT '28' AS size, 0 AS position UNION ALL SELECT '30', 1 UNION ALL SELECT '32', 2 UNION ALL SELECT '34', 3 UNION ALL SELECT '36', 4 UNION ALL SELECT '38', 5) v
WHERE p.department IN ('Men','Women','Unisex') AND p.category='Bottoms'
UNION ALL
SELECT p.id, v.size, v.position FROM products p
JOIN (SELECT '2Y' AS size, 0 AS position UNION ALL SELECT '4Y', 1 UNION ALL SELECT '6Y', 2 UNION ALL SELECT '8Y', 3 UNION ALL SELECT '10Y', 4 UNION ALL SELECT '12Y', 5 UNION ALL SELECT '14Y', 6) v
WHERE p.department='Kids';
