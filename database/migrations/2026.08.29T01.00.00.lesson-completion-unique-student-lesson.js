'use strict';

const INDEX_NAME = 'lesson_completions_student_lesson_unique';

async function up(knex) {
  const hasTable = await knex.schema.hasTable('lesson_completions');

  if (!hasTable) {
    return;
  }

  await knex.raw(`
    UPDATE lesson_completions lc
    SET student_lesson_key = s.user_id || ':' || l.lesson_id
    FROM lesson_completions_student_lnk s, lesson_completions_lesson_lnk l
    WHERE s.lesson_completion_id = lc.id
      AND l.lesson_completion_id = lc.id
      AND lc.student_lesson_key IS NULL
  `);

  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX_NAME} ON lesson_completions (student_lesson_key)`,
  );
}

async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS ${INDEX_NAME}`);
}

module.exports = { up, down };
