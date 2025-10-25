/**
 * Downloads an image from a URL and stores it permanently in Firebase Storage via server API
 */
export async function storeImagePermanently(imageUrl: string, conversationId: string, messageId: string): Promise<string> {
  try {
    const response = await fetch('/api/store-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl, conversationId, messageId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store image: ${response.statusText}`);
    }

    const data = await response.json();
    return data.permanentUrl;
  } catch (error) {
    console.error('Error storing image permanently:', error);
    // Return the original URL as fallback
    return imageUrl;
  }
}

/**
 * Stores multiple images permanently
 */
export async function storeImagesPermanently(
  imageData: { imageUrl?: string; imageDescription?: string; imageStyle?: string; revisedPrompt?: string },
  conversationId: string,
  messageId: string
): Promise<{ imageUrl?: string; imageDescription?: string; imageStyle?: string; revisedPrompt?: string }> {
  if (!imageData.imageUrl) {
    return imageData;
  }
  
  try {
    const permanentUrl = await storeImagePermanently(imageData.imageUrl, conversationId, messageId);
    return {
      ...imageData,
      imageUrl: permanentUrl
    };
  } catch (error) {
    console.error('Error storing images permanently:', error);
    return imageData;
  }
}
