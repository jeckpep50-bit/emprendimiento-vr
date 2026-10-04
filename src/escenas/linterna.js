import * as THREE from 'three';
import { EscenaExploracion } from './exploracion.js';

const TIEMPO_REVELAR = 0.9;

/**
 * Linterna UV: la escena queda a oscuras y el mando se vuelve una linterna
 * ultravioleta. Al iluminar un objeto un momento aparecen los microbios
 * escondidos (puntos que brillan) y se revela un dato. También se puede tocar.
 * datos: igual que "exploracion" ({ titulo, instruccion, minimo?, elementos: [...] }).
 */
export class EscenaLinterna extends EscenaExploracion {
  construir() {
    this.textoAyuda = this.t('linternaAyuda');
    if (!this.datos.instruccion) this.datos = { ...this.datos, instruccion: this.t('linternaInstruccion') };
    super.construir();
    const { app } = this.m;
    this._luces = { hemi: app.hemi.intensity, sol: app.sol.intensity, fondo: app.escena.background?.clone(), niebla: app.escena.fog };
    app.hemi.intensity = 0.22;
    app.sol.intensity = 0.08;
    app.escena.background = new THREE.Color('#05070f');
    // Niebla oscura cercana: la cocina desaparece en la penumbra y solo se ve lo cercano.
    app.escena.fog = new THREE.Fog('#05070f', 1.7, 5.5);

    // Cono violeta en cada mando de VR
    this.conos = [];
    for (const p of this.m.entrada.punteros) {
      if (p.tipo !== 'xr') continue;
      const cono = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 2.6, 28, 1, true),
        new THREE.MeshBasicMaterial({ color: '#9b5cff', transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      cono.rotation.x = Math.PI / 2;
      cono.position.z = -1.3;
      p.objeto.add(cono);
      this.conos.push(cono);
    }

    const centro = new THREE.Vector3();
    const v = new THREE.Vector3();
    this.cadaCuadro((dt, t) => {
      const enVR = this.m.app.enVR;
      const punteros = this.m.entrada.punteros.filter((p) => p.activo && (p.tipo === 'xr' ? enVR : !enVR) && !p.suspendido);
      for (const nodo of this.nodos) {
        const datos = nodo.userData;
        if (datos.revelado) {
          datos.nube.material.opacity = 0.75 + Math.sin(t * 4 + datos.fase) * 0.2;
          continue;
        }
        nodo.getWorldPosition(centro);
        let iluminado = false;
        for (const p of punteros) {
          v.copy(centro).sub(p.origen);
          const dist = v.length();
          if (dist < 4 && v.angleTo(p.dir) < Math.max(0.07, 0.17 / dist)) iluminado = true;
        }
        datos.exposicion = THREE.MathUtils.clamp((datos.exposicion ?? 0) + (iluminado ? dt : -dt * 0.6), 0, TIEMPO_REVELAR);
        const k = datos.exposicion / TIEMPO_REVELAR;
        datos.nube.material.opacity = k * 0.6;
        datos.halo.userData.encendido = iluminado;
        if (k >= 1) this._descubrir(datos.el, nodo, datos.etiqueta);
      }
    });
  }

  _crearElemento(el, angulo, y) {
    const nodo = super._crearElemento(el, angulo, y);
    // Nube de microbios escondidos alrededor del objeto (invisible hasta iluminarla)
    const tam = el.tamano ?? 0.3;
    const n = 70;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3().randomDirection().multiplyScalar(tam * (0.3 + Math.random() * 0.35));
      pos.set([d.x, d.y, d.z + tam * 0.15], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const nube = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#b6ff5f', size: 0.018, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    nodo.add(nube);
    nodo.userData.nube = nube;
    nodo.userData.fase = Math.random() * 6;
    return nodo;
  }

  _descubrir(el, nodo, etiqueta) {
    const primera = !nodo.userData.revelado;
    nodo.userData.revelado = true;
    super._descubrir(el, nodo, etiqueta);
    if (!primera) return;
    this.m.fx.pixeles(this.posMundo(nodo), '#b6ff5f', 36, 0.5);
    this.m.audio.tono(220, 0.5, { hasta: 880, volumen: 0.08, pos: this.posMundo(nodo) });
  }

  destruir() {
    const { app } = this.m;
    app.hemi.intensity = this._luces.hemi;
    app.sol.intensity = this._luces.sol;
    app.escena.background = this._luces.fondo;
    app.escena.fog = this._luces.niebla;
    for (const cono of this.conos) {
      cono.removeFromParent();
      cono.geometry.dispose();
      cono.material.dispose();
    }
    super.destruir();
  }
}
