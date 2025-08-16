-- Create admin user (password: admin123)
INSERT INTO users (email, password_hash, first_name, last_name, role, work_type) 
VALUES (
  'admin@animaker.com', 
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Admin', 
  'User', 
  'admin',
  'All'
);
