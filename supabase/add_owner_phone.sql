-- Migration: Add owner_phone column to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(20);
