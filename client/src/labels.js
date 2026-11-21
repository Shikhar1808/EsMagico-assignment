export const SUBJECTS = [
  ['maths', 'Maths'],
  ['science', 'Science'],
  ['english', 'English'],
  ['social_studies', 'Social studies'],
  ['second_language', 'Second language'],
];
export const SUBJECT_LABEL = Object.fromEntries(SUBJECTS);

export const FIELD_LABEL = {
  student_id: 'Student ID', full_name: 'Name', email: 'Email', date_of_birth: 'Date of birth',
  grade_level: 'Class', section: 'Section', ...SUBJECT_LABEL,
};

export const num = (n) => n.toLocaleString('en-IN');
