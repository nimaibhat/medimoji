// Simple test to verify Firebase permissions
export async function testFirebaseConnection() {
  try {
    console.log('Testing Firebase connection...');
    
    // Try to write to a simple test collection
    const testDoc = await addDoc(collection(db, 'test'), {
      message: 'Hello Firebase',
      timestamp: new Date().toISOString(),
      userId: 'test-user'
    });
    
    console.log('Firebase test successful:', testDoc.id);
    return true;
  } catch (error) {
    console.error('Firebase test failed:', error);
    return false;
  }
}
