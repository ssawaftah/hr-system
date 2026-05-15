const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const {
  getSelfProfile,
  getToday,
  checkInOut,
  getSelfAttendance,
  getSelfRequests,
  getSelfSalarySlip,
} = require('../controllers/employee-portal.controller');

router.use(authMiddleware);
router.get('/profile', getSelfProfile);
router.get('/today', getToday);
router.post('/attendance', checkInOut);
router.get('/attendance', getSelfAttendance);
router.get('/requests', getSelfRequests);
router.get('/salary-slip', getSelfSalarySlip);

module.exports = router;
