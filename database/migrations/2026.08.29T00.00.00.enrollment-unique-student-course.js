'use strict';


const INDEX_NAME = 'enrollments_student_course_unique';

async function up(knex) {
  const hasTable = await knex.schema.hasTable('enrollments');

  if (!hasTable) {
    return;
  }

  await knex.raw(`
    UPDATE enrollments e
    SET student_course_key = s.user_id || ':' || c.course_id
    FROM enrollments_student_lnk s, enrollments_course_lnk c
    WHERE s.enrollment_id = e.id
      AND c.enrollment_id = e.id
      AND e.student_course_key IS NULL
  `);

  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX_NAME} ON enrollments (student_course_key)`,
  );
}

async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS ${INDEX_NAME}`);
}

module.exports = { up, down };
