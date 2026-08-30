console.log('[VOICE ORB DEBUG] ===== voice-orb.js LOADING STARTED =====');
console.log('[VOICE ORB DEBUG] Script execution started');
console.log('[VOICE ORB DEBUG] Current timestamp:', new Date().toISOString());

/**
 * Animated AI Orb Component
 * Creates a beautiful, glowing, particle-based orb that reacts to audio
 */
class VoiceOrb {
    constructor(canvas) {
        console.log('[VOICE ORB] Initializing VoiceOrb');
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.state = 'idle'; // idle, listening, thinking, speaking, error
        this.amplitude = 0;
        this.targetAmplitude = 0;
        this.rotation = 0;
        this.pulsePhase = 0;
        this.animationId = null;
        
        console.log('[VOICE ORB] Canvas element:', canvas);
        console.log('[VOICE ORB] Canvas context:', this.ctx);
        
        this.resize();
        this.initParticles();
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
        console.log('[VOICE ORB] VoiceOrb initialized successfully');
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.baseRadius = Math.min(this.canvas.width, this.canvas.height) * 0.35;
    }

    initParticles() {
        this.particles = [];
        const particleCount = 150;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * this.baseRadius,
                speed: 0.002 + Math.random() * 0.003,
                size: 1 + Math.random() * 2,
                opacity: 0.3 + Math.random() * 0.4,
                color: this.getParticleColor()
            });
        }
    }

    getParticleColor() {
        const colors = [
            'rgba(99, 102, 241, ',   // Indigo
            'rgba(139, 92, 246, ',   // Violet
            'rgba(59, 130, 246, ',   // Blue
            'rgba(168, 85, 247, '   // Purple
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    setState(state) {
        this.state = state;
    }

    setAmplitude(value) {
        this.targetAmplitude = value;
    }

    updateParticles() {
        const amplitudeMultiplier = 1 + this.amplitude * 0.5;
        
        this.particles.forEach(particle => {
            // Update angle for rotation
            particle.angle += particle.speed * (this.state === 'thinking' ? 2 : 1);
            
            // Update radius based on state and amplitude
            let targetRadius = particle.radius;
            
            if (this.state === 'listening') {
                targetRadius = particle.radius * (1 + this.amplitude * 0.8);
            } else if (this.state === 'speaking') {
                targetRadius = particle.radius * (1 + this.amplitude * 0.6);
            } else if (this.state === 'thinking') {
                targetRadius = particle.radius * (1 + Math.sin(this.pulsePhase) * 0.1);
            }
            
            particle.radius += (targetRadius - particle.radius) * 0.1;
            
            // Update opacity based on state
            let targetOpacity = particle.opacity;
            
            if (this.state === 'listening') {
                targetOpacity = particle.opacity * (1 + this.amplitude * 0.5);
            } else if (this.state === 'speaking') {
                targetOpacity = particle.opacity * (1 + this.amplitude * 0.3);
            }
            
            particle.opacity = Math.min(1, targetOpacity);
        });
    }

    drawGlow() {
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, this.baseRadius * 1.5
        );
        
        let glowColor;
        switch (this.state) {
            case 'listening':
                glowColor = 'rgba(239, 68, 68, 0.3)';
                break;
            case 'thinking':
                glowColor = 'rgba(99, 102, 241, 0.4)';
                break;
            case 'speaking':
                glowColor = 'rgba(16, 185, 129, 0.3)';
                break;
            case 'error':
                glowColor = 'rgba(245, 158, 11, 0.3)';
                break;
            default:
                glowColor = 'rgba(99, 102, 241, 0.2)';
        }
        
        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(0.5, glowColor.replace('0.3', '0.1').replace('0.4', '0.15').replace('0.2', '0.08'));
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawCore() {
        const pulseScale = this.state === 'idle' ? 1 + Math.sin(this.pulsePhase) * 0.05 : 1;
        const coreRadius = this.baseRadius * 0.6 * pulseScale * (1 + this.amplitude * 0.2);
        
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, coreRadius
        );
        
        let coreColor;
        switch (this.state) {
            case 'listening':
                coreColor = ['rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.2)'];
                break;
            case 'thinking':
                coreColor = ['rgba(99, 102, 241, 0.9)', 'rgba(99, 102, 241, 0.3)'];
                break;
            case 'speaking':
                coreColor = ['rgba(16, 185, 129, 0.8)', 'rgba(16, 185, 129, 0.2)'];
                break;
            case 'error':
                coreColor = ['rgba(245, 158, 11, 0.8)', 'rgba(245, 158, 11, 0.2)'];
                break;
            default:
                coreColor = ['rgba(99, 102, 241, 0.7)', 'rgba(99, 102, 241, 0.1)'];
        }
        
        gradient.addColorStop(0, coreColor[0]);
        gradient.addColorStop(1, coreColor[1]);
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, coreRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    }

    drawParticles() {
        this.particles.forEach(particle => {
            const x = this.centerX + Math.cos(particle.angle) * particle.radius;
            const y = this.centerY + Math.sin(particle.angle) * particle.radius;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size * (1 + this.amplitude * 0.5), 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color + particle.opacity + ')';
            this.ctx.fill();
        });
    }

    drawOuterRing() {
        const ringRadius = this.baseRadius * 0.9;
        const ringThickness = 2 + this.amplitude * 3;
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, ringRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(99, 102, 241, ${0.3 + this.amplitude * 0.4})`;
        this.ctx.lineWidth = ringThickness;
        this.ctx.stroke();
        
        // Draw arc segments for rotation effect
        if (this.state === 'thinking') {
            for (let i = 0; i < 3; i++) {
                const startAngle = this.rotation + (i * Math.PI * 2 / 3);
                const endAngle = startAngle + Math.PI / 3;
                
                this.ctx.beginPath();
                this.ctx.arc(this.centerX, this.centerY, ringRadius + 5, startAngle, endAngle);
                this.ctx.strokeStyle = `rgba(99, 102, 241, ${0.5 + this.amplitude * 0.3})`;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update animation parameters
        this.amplitude += (this.targetAmplitude - this.amplitude) * 0.1;
        this.pulsePhase += 0.03;
        this.rotation += 0.01;
        
        // Draw components
        this.drawGlow();
        this.updateParticles();
        this.drawOuterRing();
        this.drawCore();
        this.drawParticles();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener('resize', () => this.resize());
    }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceOrb;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    console.log('[VOICE ORB] Exporting VoiceOrb to window object');
    window.VoiceOrb = VoiceOrb;
    console.log('[VOICE ORB] VoiceOrb exported successfully');
    console.log('[VOICE ORB DEBUG] ===== voice-orb.js LOADING COMPLETED =====');
}