// Post-Confirmation Lambda for Cognito
// Automatically adds new users to the "Users" group after email confirmation

const { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const client = new CognitoIdentityProviderClient();

exports.handler = async (event) => {
  console.log('Post-confirmation trigger:', JSON.stringify(event, null, 2));
  
  try {
    // Add user to default "Users" group
    const command = new AdminAddUserToGroupCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      GroupName: 'Users'
    });
    
    await client.send(command);
    console.log(`✅ Successfully added user ${event.userName} to Users group`);
    
    // Return the event to continue the authentication flow
    return event;
  } catch (error) {
    console.error('❌ Error adding user to group:', error);
    
    // IMPORTANT: Don't fail the confirmation process
    // User can still be manually added to group later
    // We return the event to allow signup to complete
    return event;
  }
};
