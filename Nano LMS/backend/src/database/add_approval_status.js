const { query } = require('./connection');

const addApprovalStatus = async () => {
  try {
    console.log('🔄 Adding approval status to users table...');

    // Add approval_status column to users table
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' 
      CHECK (approval_status IN ('pending', 'approved', 'rejected'))
    `);

    // Update existing users to be approved (except new registrations)
    await query(`
      UPDATE users 
      SET approval_status = 'approved' 
      WHERE approval_status IS NULL OR approval_status = 'pending'
    `);

    console.log('✅ Approval status added successfully!');
  } catch (error) {
    console.error('❌ Error adding approval status:', error);
    throw error;
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  addApprovalStatus()
    .then(() => {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addApprovalStatus };


