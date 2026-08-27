-- =====================================================================
-- THE HORIZON ACADEMY — FEES MANAGEMENT SYSTEM
-- Database: MySQL 8+ (or MariaDB 10.4+)
-- This mirrors the Laravel migrations 1:1. Import directly with:
--   mysql -u root -p horizon_academy < schema.sql
-- (create the database first: CREATE DATABASE horizon_academy;)
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `programs` (
  `id`            VARCHAR(60)     NOT NULL,
  `category`      VARCHAR(100)    NOT NULL,
  `name`          VARCHAR(191)    NOT NULL,
  `fee`           DECIMAL(10,2)   NOT NULL DEFAULT 0,
  `admissionFee`  DECIMAL(10,2)   NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP       NULL DEFAULT NULL,
  `updated_at`    TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `students` (
  `id`               VARCHAR(60)    NOT NULL,
  `studentCode`      VARCHAR(50)    NULL,
  `name`             VARCHAR(191)   NOT NULL,
  `father`           VARCHAR(191)   NULL,
  `contact`          VARCHAR(50)    NULL,
  `photo`            LONGTEXT       NULL,
  `programId`        VARCHAR(60)    NULL,
  `admissionDate`    VARCHAR(30)    NULL,
  `monthlyFee`       DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `discount`         DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `discountReason`   VARCHAR(255)   NULL,
  `admissionFee`     DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `created_at`       TIMESTAMP      NULL DEFAULT NULL,
  `updated_at`       TIMESTAMP      NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `students_programId_idx` (`programId`),
  CONSTRAINT `students_programId_fk` FOREIGN KEY (`programId`)
    REFERENCES `programs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id`          VARCHAR(60)    NOT NULL,
  `receiptNo`   INT             NULL,
  `studentId`   VARCHAR(60)    NULL,
  `date`        VARCHAR(30)    NULL,
  `amount`      DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `purpose`     VARCHAR(191)   NULL,
  `mode`        VARCHAR(50)    NULL,
  `note`        TEXT           NULL,
  `created_at`  TIMESTAMP      NULL DEFAULT NULL,
  `updated_at`  TIMESTAMP      NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `payments_studentId_idx` (`studentId`),
  CONSTRAINT `payments_studentId_fk` FOREIGN KEY (`studentId`)
    REFERENCES `students` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expenses` (
  `id`          VARCHAR(60)    NOT NULL,
  `date`        VARCHAR(30)    NULL,
  `amount`      DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `category`    VARCHAR(191)   NULL,
  `note`        TEXT           NULL,
  `created_at`  TIMESTAMP      NULL DEFAULT NULL,
  `updated_at`  TIMESTAMP      NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- key_value_store — holds `settings` and `trash` as JSON blobs, exactly
-- like the original app's `kv` table (simplest safe home for the
-- flexible settings object and the soft-delete trash bins).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `key_value_store` (
  `k`           VARCHAR(60)  NOT NULL,
  `v`           LONGTEXT     NULL,
  `created_at`  TIMESTAMP    NULL DEFAULT NULL,
  `updated_at`  TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Seed data: default programmes (only meaningful on a fresh database)
-- ---------------------------------------------------------------------
INSERT INTO `programs` (`id`, `category`, `name`, `fee`, `admissionFee`) VALUES
  ('9-sci',        'School',       '9th — Science',               2500, 3000),
  ('9-cs',         'School',       '9th — Computer Science',      2500, 3000),
  ('10-sci',       'School',       '10th — Science',              2800, 3000),
  ('10-cs',        'School',       '10th — Computer Science',     2800, 3000),
  ('fy-med',       'Intermediate', '1st Year — Medical',          3500, 4000),
  ('fy-pe',        'Intermediate', '1st Year — Pre-Engineering',  3500, 4000),
  ('fy-cs',        'Intermediate', '1st Year — Computer Science', 3500, 4000),
  ('fy-com',       'Intermediate', '1st Year — Commerce',         3200, 4000),
  ('sy-med',       'Intermediate', '2nd Year — Medical',          3500, 4000),
  ('sy-pe',        'Intermediate', '2nd Year — Pre-Engineering',  3500, 4000),
  ('sy-cs',        'Intermediate', '2nd Year — Computer Science', 3500, 4000),
  ('sy-com',       'Intermediate', '2nd Year — Commerce',         3200, 4000),
  ('comp-course',  'Skills',       'Computer Courses',            2000, 1500),
  ('eng-lang',     'Skills',       'English Language',            1800, 1500)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Default settings blob (matches the original app's DEFAULT_SETTINGS)
INSERT INTO `key_value_store` (`k`, `v`) VALUES
  ('settings', JSON_OBJECT(
      'receiptSeq', 1000, 'studentSeq', 1,
      'pinEnabled', false, 'pinHash', NULL,
      'dueDay', 10, 'lateFeePerDay', 0, 'lateFeeCap', 0,
      'centreAddress', '', 'centrePhone', '',
      'receiptFooterNote', 'Thank you. Please keep this receipt for your records.'
  )),
  ('trash', JSON_OBJECT('students', JSON_ARRAY(), 'payments', JSON_ARRAY(), 'expenses', JSON_ARRAY()))
ON DUPLICATE KEY UPDATE `k` = `k`;

SET FOREIGN_KEY_CHECKS = 1;
