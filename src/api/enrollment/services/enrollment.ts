// "Enroll in a course" is Student-only in the permission matrix 
const ENROLLING_ROLE = 'Student';


function publicCourse(course: any) {
  return {
    id: course.id,
    documentId: course.documentId,
    title: course.title,
    description: course.description,
    coverImageUrl: course.coverImageUrl,
    instructor: course.instructor
      ? {
          id: course.instructor.id,
          fullName: course.instructor.fullName ?? course.instructor.username,
        }
      : null,
  };
}

export default ({ strapi }: { strapi: any }) => ({
  // `user` is ctx.state.user, from the verified token. The student is taken from it and never from the body, so nobody can enrol somebody else.
  async enroll(user: any, courseDocumentId: string) {
    if (user.role?.name !== ENROLLING_ROLE) {
      throw new Error('Only students can enrol in a course');
    }

    if (!courseDocumentId) {
      throw new Error('A course is required');
    }

    const course = await strapi.documents('api::course.course').findOne({
      documentId: courseDocumentId,
      populate: ['instructor'],
    });

    if (!course) {
      throw new Error('That course does not exist');
    }

    const existing = await strapi.query('api::enrollment.enrollment').findOne({
      where: {
        student: user.id,
        course: course.id,
      },
    });

    if (existing) {
      throw new Error('You are already enrolled in this course');
    }

    let enrollment: any;

    try {
      
      enrollment = await strapi.documents('api::enrollment.enrollment').create({
        data: {
          student: user.id,
          course: course.id,
          enrolledAt: new Date(),
          studentCourseKey: `${user.id}:${course.id}`,
        },
      });
    } catch (error: any) {
      // Only the unique constraint firing. Anything else is rethrown.
      if (error?.name === 'ValidationError') {
        throw new Error('You are already enrolled in this course');
      }

      throw error;
    }

    return {
      id: enrollment.id,
      documentId: enrollment.documentId,
      enrolledAt: enrollment.enrolledAt,
      course: publicCourse(course),
    };
  },

  
  async mine(studentId: number) {
    const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
      filters: { student: studentId },
      populate: { course: { populate: ['instructor'] } },
      sort: { enrolledAt: 'desc' },
    });

    return enrollments
      // A course deleted after enrolment leaves the row with no course.
      .filter((enrollment: any) => enrollment.course)
      .map((enrollment: any) => ({
        id: enrollment.id,
        documentId: enrollment.documentId,
        enrolledAt: enrollment.enrolledAt,
        course: publicCourse(enrollment.course),
      }));
  },
});
