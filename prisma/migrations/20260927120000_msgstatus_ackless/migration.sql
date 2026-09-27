-- Add ACK-less delivery outcomes while retaining legacy READ for compatibility.
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'READ_CONFIRMED';
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'READ_UNOBSERVED';
