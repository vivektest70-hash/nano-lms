-- Create lesson_media table for storing screen recording metadata
CREATE TABLE IF NOT EXISTS lesson_media (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  duration_sec INTEGER,
  width INTEGER,
  height INTEGER,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lesson_media_course_id ON lesson_media(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_media_lesson_id ON lesson_media(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_media_uploaded_by ON lesson_media(uploaded_by);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lesson_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lesson_media_updated_at
  BEFORE UPDATE ON lesson_media
  FOR EACH ROW
  EXECUTE FUNCTION update_lesson_media_updated_at();
