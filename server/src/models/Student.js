import mongoose from 'mongoose';
import { EMAIL_RE, HAS_LETTER } from '../helpers/csvValidator.js';

const mark = { type: Number, required: true, min: 0, max: 100 };

const studentSchema = new mongoose.Schema(
  {
    student_id: { type: String, required: true, unique: true, uppercase: true, match: /^[A-Z0-9-]{3,20}$/ },
    full_name: { type: String, required: true, minlength: 2, maxlength: 100, match: HAS_LETTER },
    email: { type: String, required: true, lowercase: true, match: EMAIL_RE },
    date_of_birth: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD, no time zone shifts
    grade_level: { type: Number, required: true, min: 1, max: 12 },
    section: { type: String, required: true, enum: ['A', 'B', 'C', 'D', 'E', 'F'] },
    marks: {
      maths: mark,
      science: mark,
      english: mark,
      social_studies: mark,
      second_language: mark,
    },

    total: { type: Number, required: true },
    max_total: { type: Number, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, required: true, enum: ['A', 'B', 'C', 'D', 'F'] },
    passed: { type: Boolean, required: true },
    pass_mark: { type: Number, required: true },
  },
  {
    collection: 'students',
    versionKey: false,
    
    timestamps: { createdAt: 'created_at', updatedAt: false }, // Only created_at: an updatedAt would change on every re-upload, so "unchanged" rows could never be detected.
  },
);

studentSchema.index({ grade_level: 1, student_id: 1 });

export default mongoose.model('Student', studentSchema);
