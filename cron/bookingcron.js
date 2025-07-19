// const cron = require('node-cron');
// const bookingModel = require('../models/bookingModel');

// // Schedule the task to run every minute
// cron.schedule('* * * * *', async () => {
//   console.log('Running cron job to update booking statuses...');
  
//   try {
//     // Get all bookings where the endTime is in the past and status is not already "Completed" or "Cancelled"
//     const bookingsToUpdate = await bookingModel.find({
//       endTime: { $lt: new Date() }, // endTime has passed
//       status: { $ne: 'Completed', $ne: 'Cancelled' }, // Exclude "Completed" and "Cancelled" status
//     });

//     // Update each booking status to "Completed"
//     bookingsToUpdate.forEach(async (booking) => {
//       try {
//         booking.status = 'Completed';
//         await booking.save(); // Save updated booking
//         console.log(`Booking ${booking._id} status updated to "Completed"`);
//       } catch (err) {
//         console.error(`Error updating booking ${booking._id}:`, err);
//       }
//     });
//   } catch (err) {
//     console.error('Error fetching bookings:', err);
//   }
// });






// cron/updateBookingStatus.js
const cron = require('node-cron');
const moment = require('moment');
 // Assuming Booking is your mongoose model for bookings
const bookingModel = require('../models/bookingModel');

// Update booking status based on conditions
const updateBookingStatus = async (id, status) => {
  try {
    // Update the status in the database (using Mongoose)
    await bookingModel.findByIdAndUpdate(id, { status });
    console.log(`Booking ${id} status updated to: ${status}`);
  } catch (error) {
    console.error(`Error updating booking ${id} status:`, error);
  }
};

// Cron job to check booking status every minute
cron.schedule('* * * * *', async () => {
  console.log('Running cron job to update booking statuses...');

  try {
    // Find all bookings that are still active and not cancelled
    const currentTime = moment.utc().add(2, 'hours'); // Add 2 hours to UTC time
    console.log("Current Time (SA timezone):", currentTime.toISOString());

    // Find all bookings with endTime earlier than the current time
    const bookings = await bookingModel.find({
      status: { $ne: 'Cancelled' },
      endTime: { $lt: currentTime.toDate() }, // Compare endTime with adjusted current time
    });

    bookings.forEach(async (booking) => {
        // const currentTime = moment(); // Current time
        const startTime = booking.startTime;
        const endTime = booking.endTime;
//       console.log("booking.startTime",booking.startTime)
// console.log("start",startTime)
// console.log("end",endTime)
// console.log("currentTime",currentTime)


      if (currentTime.isAfter(startTime) && currentTime.isBefore(endTime)) {
        // If booking is in progress and status is not "Processing"
        if (booking.status !== 'Processing') {
          await updateBookingStatus(booking._id, 'Processing');
        }
      } else if (currentTime.isAfter(endTime)) {
        // If booking has ended and status is neither "Completed" nor "Rated"
        if (booking.status !== 'Completed' && booking.status !== 'Rated') {
          await updateBookingStatus(booking._id, 'Completed');
        }
      }
    });
  } catch (error) {
    console.error('Error running cron job:', error);
  }
});

module.exports = updateBookingStatus;
