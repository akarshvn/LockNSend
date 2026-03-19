# LockNSend — End-to-End Encrypted File Sharing

LockNSend is a high-performance, cryptographically secure desktop application for sharing and storing files with encryption. Built with **Electron**, **React**, and **Node.js**, it ensures that your private data never leaves your machine in an unencrypted state.

## Key Features

- **End-to-End Encryption**: All files are encrypted locally using **AES-256-GCM** before being uploaded or shared.
- **Secure Key Exchange**: Uses **RSA-4096 (OAEP)** for secure File Encryption Key (FEK) wrapping.
- **Digital Signatures**: All mutating API requests are signed via **RSA-PSS** to prevent tampering and replay attacks.
- **Multi-User Simulation**: Built-in support for multiple isolated sessions to test sharing flows on a single machine.
- **Large File Support**: Streaming encryption/decryption ensures minimal memory footprint even for gigabyte-scale files.
- **Local-First Architecture**: Your keys are stored only in memory and your files are managed by a local Express server.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Zustand
- **Desktop Shell**: Electron (latest)
- **Backend (Local)**: Express.js, Node.js Built-in `crypto` module
- **Database**: SQLite (via `better-sqlite3`)
- **Native Rebuilds**: `@electron/rebuild` for cross-platform compatibility

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/akarshvn/LockNSend.git
    cd LockNSend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Rebuild Native Modules (Crucial for macOS/Windows)**:
    ```bash
    npm run rebuild
    ```

4.  **Fix macOS SIGKILL (if needed)**:
    If the app crashes on launch on macOS, run:
    ```bash
    ./fix-mac-sigkill.sh
    ```

## Development

Run the Vite dev server and Electron app simultaneously:
```bash
npm run dev
```

### Multi-User Testing (Simulation)

To test sharing between two different users on the same machine:
1.  Click the **"Open New Secure Window"** icon at the top right in the navbar.
2.  Login as **User A** in the first window.
3.  Login as **User B** in the second window.
4.  Upload as User A → Share with User B → Download as User B!

## Cryptographic Specification

LockNSend implements a multi-layered security model using the following standards:

### Symmetric Encryption: AES-256-GCM
- **Algorithm**: Advanced Encryption Standard (AES) with a 256-bit key in Galois/Counter Mode (GCM).
- **Authentication**: Provides authenticated encryption with associated data (AEAD). Each file has a unique 96-bit Initialization Vector (IV) and generates a 128-bit authentication tag to ensure data integrity.

### Asymmetric Cryptography: RSA-4096
- **Key Length**: 4096-bit RSA keys for high-strength long-term security.
- **Key Wrapping (OAEP)**: File Encryption Keys (FEKs) are shared using RSA-OAEP (Optimal Asymmetric Encryption Padding) with a SHA-256 hash.
- **Digital Signatures (PSS)**: API requests are authenticated using RSA-PSS (Probabilistic Signature Scheme). This ensures non-repudiation and prevents request tampering.

### Key Derivation: scrypt
- **Usage**: Used for password hashing and deriving master keys for local storage of the user's RSA private key.
- **Parameters**: N=16384, r=8, p=1. Provides strong resistance against brute-force and hardware acceleration attacks while maintaining low latency on modern hardware.

### Session Security: HMAC-SHA256
- **Usage**: Session tokens are signed using HMAC-SHA256.
- **Integrity**: Ensures that session state cannot be modified by the client.

### Integrity Verification: SHA-256
- **Usage**: A full SHA-256 hash of the ciphertext is calculated during the streaming process to verify file integrity on disk.