# VFX Launcher

VFX Launcher is a desktop application designed for visual effects artists to manage, organize, and directly launch their Nuke and After Effects project files. Built with Tauri, Rust, React, and SQLite, it provides a fast, efficient interface for working with VFX projects across multiple environments.

![VFX Launcher](./vfx-launcher/src-tauri/icons/128x128.png)

## 🌟 Features

- **Project Management**: Add, remove, and organize VFX projects
- **Automated File Scanning**: Automatically scans project folders for `.nk` (Nuke) and `.aep` (After Effects) files
- **Version Management**: Groups files by name and allows easy switching between versions
- **Shot Grouping**: Intelligently groups files by shot identifier
- **Direct Application Launch**: Open files directly in Nuke or After Effects with a single click
- **Background File Watching**: Automatically detects file changes
- **Multi-user Capability**: Network database support for team collaboration
- **Project Templates**: Create new projects from predefined templates
- **Dark Mode UI**: Modern, sleek user interface designed for VFX artists
- **User Authentication**: Secure login system with user management
- **Activity Tracking**: Logs user activities for better workflow management

## 📋 Requirements

### General Requirements
- **Nuke**: For opening `.nk` files (path must be set in settings)
- **After Effects**: For opening `.aep` files (path must be set in settings)
- **Network Share** (optional): For multi-user functionality

### Development Requirements

#### All Platforms
- Node.js 16.x or later
- npm 7.x or later
- Rust 1.60.0 or later with cargo
- Git

#### Windows-specific
- Microsoft Visual Studio C++ Build Tools
- Windows 10 or later
- PowerShell 5.0 or later

#### macOS-specific
- Xcode Command Line Tools
- macOS 10.15 (Catalina) or later
- Homebrew (recommended for installing dependencies)

#### Linux-specific
- Ubuntu 20.04 or equivalent
- build-essential package
- libwebkit2gtk-4.0-dev
- Additional libraries: libgtk-3-dev, libayatana-appindicator3-dev, librsvg2-dev

## 🚀 Installation

### For Users

#### Windows
1. Download the latest `.msi` installer from the releases page
2. Run the installer and follow the prompts
3. Launch VFX Launcher from the Start menu

#### macOS
1. Download the latest `.dmg` file from the releases page
2. Open the DMG file and drag VFX Launcher to your Applications folder
3. Launch from Applications or Spotlight

#### Linux
1. Download the appropriate package for your distribution (`.deb`, `.rpm`, or `.AppImage`)
2. Install using your package manager or make the AppImage executable
3. Launch from your applications menu

### For Developers

#### Setting Up the Development Environment

1. Install Node.js and npm:
   ```
   # Windows - using chocolatey
   choco install nodejs

   # macOS - using homebrew
   brew install node

   # Linux
   sudo apt update
   sudo apt install nodejs npm
   ```

2. Install Rust and Cargo:
   ```
   # All platforms
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

3. Install Tauri CLI:
   ```
   npm install -g @tauri-apps/cli
   ```

4. Clone the repository:
   ```
   git clone https://github.com/yourusername/vfx-launcher.git
   cd vfx-launcher
   ```

5. Install dependencies:
   ```
   cd vfx-launcher
   npm install
   ```

6. Run in development mode:
   ```
   npm run tauri dev
   ```

7. Build for production:
   ```
   npm run tauri build
   ```

## ⚙️ Configuration

### Database Configuration

The application can be configured to use a local or network database:

1. Open `src-tauri/config.toml`
2. Configure the database mode and paths:
   ```toml
   [database]
   # Database mode: "network" or "local"
   mode = "network"
   # Network database path
   network_path = "/path/to/network/share/DB"
   ```

3. For network functionality, ensure the network path is accessible and mounted on all machines.

### Default Admin User

The first time the application runs, it creates a default admin user:
- Username: `admin`
- Password: `admin`

**Important**: Change this password immediately by logging in and accessing the user management section.

## 🖥️ Usage

### Adding Projects

1. Click the "Add Project" button in the projects sidebar
2. Enter the project name and path
3. Select the project template (optional)
4. Click "Create"

### Managing Files

1. Select a project from the sidebar
2. Use the filter controls to show/hide file types
3. Expand shot groups to see file versions
4. Select versions from the dropdown
5. Click on a file to open it in the appropriate application

### Using Templates

1. Navigate to the Templates section in settings
2. Create new templates by defining folder structures in JSON/YAML format
3. Use templates when creating new projects

## 🔧 Troubleshooting

### Application Won't Start

- Check logs in:
  - Windows: `%APPDATA%\vfx-launcher\logs`
  - macOS: `~/Library/Logs/vfx-launcher`
  - Linux: `~/.config/vfx-launcher/logs`

### Can't Connect to Network Database

- Ensure the network share is mounted
- Check path in `config.toml`
- Verify user has read/write permissions to the database folder

### Files Not Opening

- Verify Nuke/After Effects paths in settings
- Ensure the application file paths are correct

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Tauri](https://tauri.app/) - For the framework that makes this cross-platform app possible
- [Rust](https://www.rust-lang.org/) - For providing a safe, performant backend
- [React](https://reactjs.org/) - For the frontend interface
- [SQLite](https://www.sqlite.org/) - For database functionality
