/* Boids — Craig Reynolds' distributed flocking model (1986/87).
 * Extends Atlas.Sim. Each boid steers by three local rules — separation,
 * alignment, cohesion — over neighbors within a perception radius. Naive
 * O(n²) neighbor search is fine at a few hundred boids. The world is a torus:
 * distances and steering wrap across the edges. Move the mouse over the stage
 * to act as a predator the flock flees. Boids are colored by heading. */
(function () {
  'use strict';
  const { Sim, clamp, rand, TAU } = Atlas;

  const MAX_FORCE = 0.05;   // steering acceleration clamp (px/tick²)
  const PREDATOR_R = 90;    // pointer flee radius (px)
  const PREDATOR_W = 1.6;   // flee weight

  class Boids extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.pointer = null;     // {x,y} when the cursor is over the stage
      this.meanSpeed = 0;
    }

    setup() {
      const n = Math.round((this.params && this.params.count) || 200);
      this.spawn(n);
    }

    // (Re)seed the flock with n boids at random positions and headings.
    spawn(n) {
      const w = this.width, h = this.height;
      const sp = (this.params && this.params.speed) || 2.2;
      this.bx = new Float32Array(n); // position x
      this.by = new Float32Array(n); // position y
      this.vx = new Float32Array(n); // velocity x
      this.vy = new Float32Array(n); // velocity y
      for (let i = 0; i < n; i++) {
        this.bx[i] = rand(w);
        this.by[i] = rand(h);
        const a = rand(TAU);
        this.bx[i] = clamp(this.bx[i], 0, w);
        this.by[i] = clamp(this.by[i], 0, h);
        this.vx[i] = Math.cos(a) * sp;
        this.vy[i] = Math.sin(a) * sp;
      }
      this.n = n;
    }

    onResize() { /* keep the flock; positions re-wrap into the new bounds */ }

    // Shortest signed delta on a torus of size L (handles wrap-around).
    wrapDelta(d, L) {
      if (d > L * 0.5) return d - L;
      if (d < -L * 0.5) return d + L;
      return d;
    }

    step() {
      const w = this.width, h = this.height, n = this.n;
      const { bx, by, vx, vy } = this;
      const sepW = this.params.separation ?? 1.4;
      const aliW = this.params.alignment ?? 1.0;
      const cohW = this.params.cohesion ?? 1.0;
      const R = this.params.perception ?? 55;
      const maxSpeed = this.params.speed ?? 2.2;
      const wrap = (this.params.edges ?? 'wrap') === 'wrap';
      const R2 = R * R;
      const sepR = R * 0.5, sepR2 = sepR * sepR; // separation acts at short range

      let speedSum = 0;

      for (let i = 0; i < n; i++) {
        let sepX = 0, sepY = 0;           // away from close flockmates
        let aliX = 0, aliY = 0;           // average neighbor velocity
        let cohX = 0, cohY = 0;           // average neighbor position offset
        let count = 0, sepCount = 0;

        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          let dx = bx[j] - bx[i];
          let dy = by[j] - by[i];
          if (wrap) { dx = this.wrapDelta(dx, w); dy = this.wrapDelta(dy, h); }
          const d2 = dx * dx + dy * dy;
          if (d2 > R2 || d2 === 0) continue;
          count++;
          aliX += vx[j]; aliY += vy[j];
          cohX += dx; cohY += dy;         // offset toward neighbor
          if (d2 < sepR2) {
            // push away, weighted by closeness (1/d falloff)
            const inv = 1 / Math.sqrt(d2);
            sepX -= dx * inv; sepY -= dy * inv;
            sepCount++;
          }
        }

        let ax = 0, ay = 0;
        if (sepCount > 0) {
          const s = this.steer(sepX, sepY, vx[i], vy[i], maxSpeed);
          ax += s.x * sepW; ay += s.y * sepW;
        }
        if (count > 0) {
          const a = this.steer(aliX / count, aliY / count, vx[i], vy[i], maxSpeed);
          ax += a.x * aliW; ay += a.y * aliW;
          const c = this.steer(cohX / count, cohY / count, vx[i], vy[i], maxSpeed);
          ax += c.x * cohW; ay += c.y * cohW;
        }

        // Predator: flee the pointer when it is near.
        if (this.pointer) {
          let dx = this.pointer.x - bx[i];
          let dy = this.pointer.y - by[i];
          if (wrap) { dx = this.wrapDelta(dx, w); dy = this.wrapDelta(dy, h); }
          const d2 = dx * dx + dy * dy;
          if (d2 < PREDATOR_R * PREDATOR_R && d2 > 0) {
            const inv = 1 / Math.sqrt(d2);
            const f = this.steer(-dx * inv, -dy * inv, vx[i], vy[i], maxSpeed);
            const near = 1 - Math.sqrt(d2) / PREDATOR_R; // stronger up close
            ax += f.x * PREDATOR_W * (0.5 + near);
            ay += f.y * PREDATOR_W * (0.5 + near);
          }
        }

        // integrate velocity, clamp to max speed
        let nvx = vx[i] + ax, nvy = vy[i] + ay;
        const sp = Math.hypot(nvx, nvy);
        if (sp > maxSpeed && sp > 0) { nvx = nvx / sp * maxSpeed; nvy = nvy / sp * maxSpeed; }
        vx[i] = nvx; vy[i] = nvy;
      }

      // integrate position with the freshly computed velocities
      for (let i = 0; i < n; i++) {
        let x = bx[i] + vx[i];
        let y = by[i] + vy[i];
        if (wrap) {
          x = ((x % w) + w) % w;
          y = ((y % h) + h) % h;
        } else {
          // bounce off the walls
          if (x < 0) { x = 0; vx[i] = Math.abs(vx[i]); }
          else if (x > w) { x = w; vx[i] = -Math.abs(vx[i]); }
          if (y < 0) { y = 0; vy[i] = Math.abs(vy[i]); }
          else if (y > h) { y = h; vy[i] = -Math.abs(vy[i]); }
        }
        bx[i] = x; by[i] = y;
        speedSum += Math.hypot(vx[i], vy[i]);
      }
      this.meanSpeed = n ? speedSum / n : 0;
    }

    // Reynolds steering: desired = normalize(vector)*maxSpeed; force =
    // (desired - velocity), clamped to MAX_FORCE.
    steer(vecX, vecY, vX, vY, maxSpeed) {
      const m = Math.hypot(vecX, vecY);
      if (m === 0) return { x: 0, y: 0 };
      const dx = vecX / m * maxSpeed - vX;
      const dy = vecY / m * maxSpeed - vY;
      const fm = Math.hypot(dx, dy);
      if (fm > MAX_FORCE && fm > 0) return { x: dx / fm * MAX_FORCE, y: dy / fm * MAX_FORCE };
      return { x: dx, y: dy };
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const { bx, by, vx, vy, n } = this;
      for (let i = 0; i < n; i++) {
        const ang = Math.atan2(vy[i], vx[i]);
        const hue = ((ang / TAU) * 360 + 360) % 360;
        ctx.fillStyle = `hsl(${hue.toFixed(0)}, 70%, 62%)`;
        // triangle pointing along velocity
        const cx = bx[i], cy = by[i];
        const ca = Math.cos(ang), sa = Math.sin(ang);
        ctx.beginPath();
        ctx.moveTo(cx + ca * 6, cy + sa * 6);                 // nose
        ctx.lineTo(cx - ca * 4 - sa * 3, cy - sa * 4 + ca * 3); // left tail
        ctx.lineTo(cx - ca * 4 + sa * 3, cy - sa * 4 - ca * 3); // right tail
        ctx.closePath();
        ctx.fill();
      }
      if (this.pointer) {
        ctx.strokeStyle = 'rgba(232,120,120,0.55)';
        ctx.beginPath();
        ctx.arc(this.pointer.x, this.pointer.y, PREDATOR_R, 0, TAU);
        ctx.stroke();
      }
    }
  }

  // ---- mount + controls ----
  const sim = new Boids('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.spawn(sim.n); sim._renderOnce(); } });
  sim.slider('separation', { min: 0, max: 2, step: 0.05, value: 1.4 });
  sim.slider('alignment', { min: 0, max: 2, step: 0.05, value: 1.0 });
  sim.slider('cohesion', { min: 0, max: 2, step: 0.05, value: 1.0 });
  sim.slider('perception', { min: 20, max: 120, step: 5, value: 55, fmt: v => v + ' px' });
  sim.slider('count', { min: 50, max: 300, step: 10, value: 200,
    fmt: v => v + '', onInput: v => { sim.spawn(Math.round(v)); if (!sim.running) sim._renderOnce(); } });
  sim.slider('speed', { min: 1, max: 4, step: 0.1, value: 2.2, fmt: v => v.toFixed(1) });
  sim.select('edges', [
    { value: 'wrap', label: 'Wrap (torus)' },
    { value: 'bounce', label: 'Bounce' }
  ], { value: 'wrap' });

  // Pointer acts as a predator the flock flees.
  sim.onPointer((type, p) => {
    if (type === 'up' || type === 'leave') { sim.pointer = null; return; }
    sim.pointer = { x: p.x, y: p.y };
  });

  sim.readout(s => `${s.n} boids  ·  mean speed ${s.meanSpeed.toFixed(2)} px/tick`);
})();
