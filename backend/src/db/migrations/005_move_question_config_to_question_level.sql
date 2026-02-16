-- Move answer scale and word cloud configuration from questionnaire level to question level

ALTER TABLE questions
ADD COLUMN IF NOT EXISTS answer_scale_id INTEGER REFERENCES answer_scales(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS word_cloud_options_id INTEGER REFERENCES word_cloud_options(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 3;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'questionnaire_questions'
      AND column_name = 'answer_scale_id'
  ) THEN
    UPDATE questions q
    SET answer_scale_id = qq.answer_scale_id
    FROM (
      SELECT DISTINCT ON (question_id) question_id, answer_scale_id
      FROM questionnaire_questions
      WHERE answer_scale_id IS NOT NULL
      ORDER BY question_id, questionnaire_id
    ) qq
    WHERE q.id = qq.question_id
      AND q.answer_scale_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'questionnaire_questions'
      AND column_name = 'word_cloud_options_id'
  ) THEN
    UPDATE questions q
    SET word_cloud_options_id = qq.word_cloud_options_id
    FROM (
      SELECT DISTINCT ON (question_id) question_id, word_cloud_options_id
      FROM questionnaire_questions
      WHERE word_cloud_options_id IS NOT NULL
      ORDER BY question_id, questionnaire_id
    ) qq
    WHERE q.id = qq.question_id
      AND q.word_cloud_options_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'questionnaire_questions'
      AND column_name = 'max_selections'
  ) THEN
    UPDATE questions q
    SET max_selections = qq.max_selections
    FROM (
      SELECT question_id, MAX(max_selections) AS max_selections
      FROM questionnaire_questions
      WHERE max_selections IS NOT NULL
      GROUP BY question_id
    ) qq
    WHERE q.id = qq.question_id
      AND q.max_selections IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'questionnaire_questions'
      AND column_name = 'answer_scale_id'
  ) THEN
    ALTER TABLE questionnaire_questions DROP COLUMN answer_scale_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'questionnaire_questions'
      AND column_name = 'word_cloud_options_id'
  ) THEN
    ALTER TABLE questionnaire_questions DROP COLUMN word_cloud_options_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'questionnaire_questions'
      AND column_name = 'max_selections'
  ) THEN
    ALTER TABLE questionnaire_questions DROP COLUMN max_selections;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_questionnaire_questions_wordcloud;
CREATE INDEX IF NOT EXISTS idx_questions_wordcloud_options ON questions(word_cloud_options_id);
