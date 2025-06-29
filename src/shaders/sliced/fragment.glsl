uniform float uSliceStart;
uniform float uSliceArc;

varying vec3 vPosition;

void main() {
    float angle = atan(vPosition.y, vPosition.x);
    angle -= uSliceStart;
    angle = mod(angle, PI2);

    bool isInSlice = angle > 0.0 && angle < uSliceArc;

    if(isInSlice) {
        discard;
    }

    bool csm_Slice; // enable sliced model custom shader
    // csm_DiffuseColor = vec4(vPosition, 1.0);

}