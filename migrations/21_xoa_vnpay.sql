-- Remove the VNPay-only transaction table. Orders now support COD and direct bank QR.
DROP TABLE IF EXISTS payment_attempts;
