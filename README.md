# 🚀 Signal Viewer – Multi-Domain Signal Processing Platform

> Advanced Web-Based Multi-Domain Signal Visualization and Analysis System  
> Medical • Acoustic • Financial • Microbiome Signals  

---

## 📌 Overview

Signal Viewer is a full-featured web-based platform designed to visualize, analyze, and process different categories of signals across multiple domains.

The system integrates:

- 🎨 Advanced interactive visualization
- 🤖 Pretrained AI-based classification
- 📊 Classical signal processing algorithms
- 🧠 Machine learning prediction models
- ⚡ Modular frontend architecture

---

# 🏗️ System Architecture

## Frontend
- Angular
- TypeScript
- Modular Component-Based Design
- Interactive Graph Rendering

## Backend
- Signal preprocessing
- Classical ML algorithms
- AI model inference
- REST API integration

---

# 🧠 1️⃣ Medical Signal Viewer

Supports multi-channel ECG / EEG visualization with abnormality detection.

## 🔹 AI-Based Abnormality Detection

When a signal is opened:
- A pretrained multi-channel AI model is triggered
- The system classifies:
  - Normal
  - 4 different abnormality types

---


## 🔬 Classical Arrhythmia Detection

Implemented classical ML-based detection using:

- Statistical features
- Autocorrelation
- RR interval analysis
- Peak detection

![AI](./screenshots/ML1.png)
![AI](./screenshots/ML2.png)
![AI](./screenshots/ML3.png)
![AI](./screenshots/ML4.png)

## 🔹 Viewer Modes

### 1️⃣ Continuous-Time Viewer

Features:
- Fixed-length viewport
- Play / Pause control
- Speed adjustment
- Zoom In / Zoom Out
- Panning
- Multi-channel synchronization

Display Modes:
- Grouped small viewers (one per channel)
- Single large viewer with:
  - Show / Hide channels
  - Custom color
  - Line thickness control

---

### 📸 Single Channel View

![Single Channel](./screenshots/single-channel1.png)
![Single Channel](./screenshots/single-channel2.png)

---

### 📸 Multi-Channel Group View

![Multi Channel](./screenshots/multi-channel1.png)
![Multi Channel](./screenshots/multi-channel2.png)
---

### 2️⃣ XOR Graph

- Signal divided into equal time chunks
- Each chunk overlaid using XOR logic
- Identical chunks cancel each other
- Highlights temporal variation

---

### 📸 XOR Graph

![XOR Graph](./screenshots/xor1.png)
![XOR Graph](./screenshots/xor2.png)

---

### 3️⃣ Polar Graph

- Radius (r) → Signal magnitude
- Theta (θ) → Time
- Supports:
  - Live mode (latest time only)
  - Cumulative mode

---

### 📸 Polar Graph

![Polar Graph](./screenshots/polar1.png)
![Polar Graph](./screenshots/polar2.png)
![Polar Graph](./screenshots/polar3.png)

---

### 4️⃣ Reoccurrence Graph

- Channel X vs Channel Y
- Cumulative scatter plotting
- Adjustable colormap
- Channel selection control

---

### 📸 Reoccurrence Graph

![Reoccurrence Graph](./screenshots/reoccurrence1.png)
![Reoccurrence Graph](./screenshots/reoccurrence2.png)

---

## Full Medical Module Video Demo:
https://github.com/user-attachments/assets/8d507eaa-f03b-4cf6-8fb0-7f9995e6f47e

# 🔊 2️⃣ Acoustic Signal Module

## 🚗 Doppler Effect Simulator

Simulates vehicle passing sound using Doppler physics model.

User controls:
- Vehicle velocity (v)
- Horn frequency (f)

Outputs:
- Generated waveform
- Real-time signal visualization

---

### 📸 Doppler Simulator

![Doppler Simulator](./screenshots/doppler1.png)
![Doppler Simulator](./screenshots/doppler2.png)

---

## 🎧 Real Vehicle Sound Analysis

- Real audio files processed
- Classic algorithm estimates:
  - Vehicle speed
  - Frequency shift
- No AI model used

---

### 📸 Vehicle Detection

![Vehicle Detection](./screenshots/vehicle-detection.png)

---

## 🚁 Drone / Detection

- Acoustic feature extraction
- ML or AI classification
- Noise discrimination

---

### 📸 Drone Detection

![Drone Detection](./screenshots/drone.png)

---

## Full Acoustic Section Video Demo
https://github.com/user-attachments/assets/8d507eaa-f03b-4cf6-8fb0-7f9995e6f47e

---

# 📈 3️⃣ Stock Market Analyzer

Supports:
- Stock market data
- Currency exchange data
- Mineral price data

Features:
- Time-series visualization
- Trend analysis
- Predictive modeling

---

### 📸 Stock Visualization

![Stock Viewer](./screenshots/stock1.png)

---

### 📸 Stock Prediction

![Stock Prediction](./screenshots/stock2.png)

---

### 📸 Candlebar Chart
![Candlebar Chart](./screenshots/stock3.png)

---

## Full Stock Module Video Demo
https://github.com/user-attachments/assets/00f22c90-2118-4b70-b9ea-57ddfbe3f336


---
# 🧬 4️⃣ Microbiome Signal Analysis

Datasets:
- iHMP

Features:
- Bacterial profiling visualization
- Patient profile estimation

---

### 📸 Microbiome Viewer

![Microbiome Viewer](./screenshots/microbiome1.png)
![Microbiome Viewer](./screenshots/microbiome2.png)
![Microbiome Viewer](./screenshots/microbiome3.png)

---
## Full Microbiome Module Video Demo
https://github.com/user-attachments/assets/a93626c6-fc7b-40ce-adce-b5fb6ddfca55

---

# ⚙️ Installation

```bash
git clone YOUR_REPO_LINK
cd project-name
npm install
ng serve

```
# 📂 Project Structure

```bash
src/
├── app/
│   ├── components/
│   │   ├── signal-viewer/
│   │   ├── doppler/
│   │   ├── DroneDetector/
│   │   ├── stock-analyzer/
│   │   ├── microbiome/
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── app.config.server.ts
│   └── app.routes.server.ts
```
# 🧪 Technologies Used

- Angular  
- TypeScript  
- Python  
- TensorFlow / PyTorch  
- Classical Signal Processing Techniques  
- REST APIs  
- Data Visualization Libraries  

---

# 🎯 Key Achievements

- Built a full multi-domain signal processing platform  
- Integrated AI and classical ML comparison  
- Implemented Doppler physics simulation  
- Developed advanced visualization systems  
- Designed scalable modular architecture  
- Enabled multi-channel real-time interaction  

---

# 👨‍💻 Authors

- **Zyad Mohamed Hamed**  
- **Engy Wael Shenif**  
- **Abdelrahman Emad Ali**  
- **Youssef Magdy Abdelkhalek**  

---

# ⭐ Future Improvements

- Real-time streaming support  
- Cloud deployment  
- Model fine-tuning  
- Larger dataset integration  
- Performance optimization  
- Mobile responsiveness  

---
