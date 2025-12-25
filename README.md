# 🎵 Sonic Waves - 3D Audio Visualizer

**Sonic Waves** is an immersive, interactive 3D audio visualization experience built with modern web technologies. It transforms your music or live audio into stunning, real-time visual landscapes using Three.js and React.

## ✨ Key Features

- **Multiple Visualizer Modes**:

  - **Bars**: A circular array of frequency bars that dance to the rhythm.
  - **Linear**: Classic spectrum analyzer style with a modern 3D twist.
  - **Sphere**: A pulsing, reactive icosahedron wireframe.
  - **Wave**: Time-domain particle wave visualization.

- **Audio Sources**:

  - 📁 **File Upload**: visualizes your local audio files (MP3, WAV, etc.).
  - 🎤 **Live Microphone**: Reacts to your voice or ambient sound in real-time.

- **Immersive 3D Environment**:

  - Built with **React Three Fiber** for high-performance 3D graphics.
  - **Post-Processing Effects**: Beautiful bloom and glow effects.
  - **Dynamic Lighting**: Colors shift and pulse based on audio frequency intensity.
  - **Interactive Controls**: Orbit around the visualization with your mouse/touch.

- **Responsive Design**:
  - Works seamlessly on Desktops, Tablets, and Mobile devices.
  - Automatic camera adjustment for different screen sizes.

## 🛠️ Tech Stack

- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **3D Engine**: [Three.js](https://threejs.org/)
- **React 3D Library**: [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) & [Drei](https://github.com/pmndrs/drei)
- **Effects**: [React Three Postprocessing](https://github.com/pmndrs/react-postprocessing)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)

## 🚀 Getting Started

Follow these steps to run the project locally.

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1.  **Clone the repository** (if applicable):

    ```bash
    git clone https://github.com/your-username/sonic-waves-visualizer.git
    cd sonic-waves-visualizer
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Start the development server**:

    ```bash
    npm run dev
    ```

4.  **Open in Browser**:
    Visit `http://localhost:5173` (or the URL shown in your terminal).

## 🎮 How to Use

1.  **Select a Visualizer**: Click on the buttons at the top (BARS, LINEAR, SPHERE, WAVE) to switch modes.
2.  **Play Music**:
    - Click **Upload** to select an audio file from your device.
    - Click **Mic** to use your microphone for live visuals.
3.  **Control**:
    - Use the Play/Pause button in the bottom floating bar.
    - Use the slider to seek through audio tracks.
    - Drag on the screen to rotate the camera around the visualization.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

This project is open-source and available under the MIT License.
