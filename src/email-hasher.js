// Email hashing utility for privacy and security
// Uses SHA256 to hash email addresses so they're never stored in plain text

class EmailHasher {
  constructor() {
    // Initialize the hashing utility
    this.algorithm = 'SHA-256';
  }

  /**
   * Hash an email address using SHA256
   * @param {string} email - The email address to hash
   * @returns {Promise<string>} - The SHA256 hash as a hex string
   */
  async hashEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email provided for hashing');
    }

    // Normalize the email (lowercase, trim whitespace)
    const normalizedEmail = email.toLowerCase().trim();
    
    // Convert string to ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedEmail);
    
    // Hash the data
    const hashBuffer = await crypto.subtle.digest(this.algorithm, data);
    
    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }

  /**
   * Check if an email hash exists in a list of allowed hashes
   * @param {string} emailHash - The hashed email to check
   * @param {string[]} allowedHashes - Array of allowed email hashes
   * @returns {boolean} - True if the hash is found in the allowed list
   */
  isEmailHashAllowed(emailHash, allowedHashes) {
    if (!emailHash || !Array.isArray(allowedHashes)) {
      return false;
    }
    
    return allowedHashes.includes(emailHash);
  }

  /**
   * Validate and hash an email, then check if it's allowed
   * @param {string} email - The plain email address
   * @param {string[]} allowedHashes - Array of allowed email hashes
   * @returns {Promise<{isValid: boolean, hash: string|null, error: string|null}>}
   */
  async validateAndHashEmail(email, allowedHashes) {
    try {
      // Basic email validation
      if (!this.isValidEmailFormat(email)) {
        return {
          isValid: false,
          hash: null,
          error: 'Invalid email format'
        };
      }

      // Hash the email
      const emailHash = await this.hashEmail(email);
      
      // Check if hash is in allowed list
      const isAllowed = this.isEmailHashAllowed(emailHash, allowedHashes);
      
      if (!isAllowed) {
        return {
          isValid: false,
          hash: emailHash,
          error: 'Email not authorized for this application'
        };
      }

      return {
        isValid: true,
        hash: emailHash,
        error: null
      };
      
    } catch (error) {
      return {
        isValid: false,
        hash: null,
        error: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Basic email format validation
   * @param {string} email - The email to validate
   * @returns {boolean} - True if email format appears valid
   */
  isValidEmailFormat(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Basic email regex - not perfect but good enough for most cases
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Generate a hash for a list of emails (utility for creating allowed-emails.json)
   * @param {string[]} emails - Array of email addresses to hash
   * @returns {Promise<{email: string, hash: string}[]>} - Array of email/hash pairs
   */
  async generateHashList(emails) {
    const results = [];
    
    for (const email of emails) {
      try {
        const hash = await this.hashEmail(email);
        results.push({
          email: email.toLowerCase().trim(),
          hash: hash
        });
      } catch (error) {
        console.warn(`Failed to hash email ${email}:`, error.message);
      }
    }
    
    return results;
  }

  /**
   * Create a user identifier from email hash (for session management)
   * @param {string} emailHash - The hashed email
   * @returns {string} - A shortened identifier for the user
   */
  createUserIdentifier(emailHash) {
    // Use first 12 characters of hash as user identifier
    // This is enough to avoid collisions in small teams while maintaining privacy
    return emailHash.substring(0, 12);
  }

  /**
   * Extract display name from plain email (before hashing)
   * @param {string} email - The plain email address
   * @returns {string|null} - Extracted name or null if extraction fails
   */
  extractDisplayNameFromEmail(email) {
    try {
      if (!email || typeof email !== 'string') {
        return null;
      }

      // Extract the part before @ symbol
      const localPart = email.toLowerCase().trim().split('@')[0];
      
      // If it contains a dot, take the first part (e.g., "andreas.heige" -> "andreas")
      // Otherwise use the whole local part (e.g., "karl" -> "karl")
      const firstName = localPart.includes('.') ? localPart.split('.')[0] : localPart;
      
      // Capitalize first letter
      return firstName.charAt(0).toUpperCase() + firstName.slice(1);
    } catch (error) {
      console.warn('Failed to extract name from email:', error.message);
      return null;
    }
  }
}

// Make it available globally
window.EmailHasher = EmailHasher;

// For backwards compatibility, also provide a global instance
window.emailHasher = new EmailHasher();