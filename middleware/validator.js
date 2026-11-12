// ============================================================================
// V Spark 2026 - Input Validation Middleware
// Lectures 11 & 12: API Security, Input Sanitization & Validation (express-validator)
// Supports Multi-University, Solo/Duo Teams, and Judge Credentials
// ============================================================================

const { body, validationResult } = require('express-validator');

// Error collector middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorList = errors.array();
    return res.status(400).json({
      success: false,
      message: errorList[0].msg,
      errors: errorList.map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// 1. Validation for Team / Student Registration
// Multi-University Support: Any Roll / Registration format allowed
const validateRegister = [
  body('leaderName')
    .trim()
    .notEmpty().withMessage('Participant / Team Leader name is required.')
    .isLength({ min: 2, max: 70 }).withMessage('Name must be between 2 and 70 characters.'),
  
  body('leaderRoll')
    .trim()
    .notEmpty().withMessage('Roll / Registration Number is required.')
    .isLength({ min: 2, max: 40 }).withMessage('Roll Number must be between 2 and 40 characters.'),
  
  body('university')
    .trim()
    .notEmpty().withMessage('University / Institute name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('University name must be between 2 and 100 characters.'),

  body('language')
    .trim()
    .toLowerCase()
    .isIn(['c', 'cpp', 'java', 'python', 'html', 'javascript', 'js', 'dart', 'php']).withMessage('Programming language must be C, C++, Java, Python, HTML, JavaScript, Dart, or PHP.'),

  body('teamType')
    .optional()
    .isIn(['solo', 'duo']).withMessage('Team type must be Solo or Duo.'),

  body('username')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters.')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Username can only contain letters, numbers, underscores, dashes, and dots.'),

  body('password')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 4, max: 50 }).withMessage('Password must be at least 4 characters long.'),

  body('secretKey')
    .optional({ checkFalsy: true })
    .trim(),

  handleValidationErrors
];

// Validation for Student / Team Login
const validateStudentLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Team Username or Roll Number is required.'),

  body('password')
    .trim()
    .notEmpty().withMessage('Password is required.'),

  handleValidationErrors
];

// 2. Validation for Code Submission
const validateSubmit = [
  body('problemId')
    .notEmpty().withMessage('Problem ID is required.')
    .isInt({ min: 1 }).withMessage('Problem ID must be a valid positive integer.'),
  
  body('language')
    .trim()
    .toLowerCase()
    .isIn(['c', 'cpp', 'java', 'python', 'html', 'javascript', 'js', 'dart', 'php']).withMessage('Language must be C, C++, Java, Python, HTML, JavaScript, Dart, or PHP.'),
  
  body('code')
    .trim()
    .notEmpty().withMessage('Solution code cannot be empty.'),

  handleValidationErrors
];

// 3. Validation for Sir / Judge Login (Username + Password)
const validateLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Judge username is required.'),

  body('password')
    .notEmpty().withMessage('Judge password is required.'),

  handleValidationErrors
];

// 4. Validation for Judge Bonus Points
const validateBonus = [
  body('submissionId')
    .trim()
    .notEmpty().withMessage('Submission ID is required.'),
  
  body('bonus')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Bonus marks must be an integer between 1 and 50.'),

  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateStudentLogin,
  validateSubmit,
  validateLogin,
  validateBonus,
  handleValidationErrors
};
