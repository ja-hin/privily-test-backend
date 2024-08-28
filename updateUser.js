const mongoose = require('mongoose');
const User = require('./models/userModel'); // Adjust the path as necessary

// Connect to MongoDB
mongoose.connect("mongodb+srv://ecommerce:DB_PASSWORD_PLACEHOLDER@cluster0.izayalx.mongodb.net/prively?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
    updateUsers();
}).catch((error) => {
    console.error('Error connecting to MongoDB', error);
});

async function updateUsers() {
    try {
        const result = await User.updateMany(
            { newField: { $exists: false } }, // Condition to update only documents missing the new field
            { $set: { newField: "defaultValue" } } // Update operation to set the new field
        );
        console.log(`Updated ${result.nModified} users with the new field.`);
    } catch (error) {
        console.error('Error updating users', error);
    } finally {
        mongoose.connection.close();
    }
}
