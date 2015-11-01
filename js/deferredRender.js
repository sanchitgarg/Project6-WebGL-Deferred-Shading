
(function() {
    'use strict';
    // deferredSetup.js must be loaded first

    R.deferredRender = function(state) {
        if (!aborted && (
            !R.progCopy ||
            !R.progRed ||
			!R.progSphere ||
            !R.progClear ||
            !R.prog_Ambient ||
            !R.prog_BlinnPhong_PointLight ||
            !R.prog_Debug ||
            !R.progPost1)) {
            console.log('waiting for programs to load...');
            return;
        }

        // Move the R.lights
        for (var i = 0; i < R.lights.length; i++) {
            // OPTIONAL TODO: Edit if you want to change how lights move
            var mn = R.light_min[1];
            var mx = R.light_max[1];
            R.lights[i].pos[1] = (R.lights[i].pos[1] + R.light_dt - mn + mx) % mx + mn;
        }

        // Execute deferred shading pipeline

        // CHECKITOUT: START HERE! You can even uncomment this:
        // debugger;

        R.pass_copy.render(state);

        if (cfg && cfg.debugView >= 0) {
            // Do a debug render instead of a regular render
            // Don't do any post-processing in debug mode
            R.pass_debug.render(state);
        } else {
            // * Deferred pass and postprocessing pass(es)
            // TODO: uncomment these
            R.pass_deferred.render(state);
            R.pass_post1.render(state);

            // OPTIONAL TODO: call more postprocessing passes, if any
        }
    };

    /**
     * 'copy' pass: Render into g-buffers
     */
    R.pass_copy.render = function(state) {
        // * Bind the framebuffer R.pass_copy.fbo
		gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_copy.fbo);

        // * Clear screen using R.progClear
        renderFullScreenQuad(R.progClear);
		
        // * Clear depth buffer to value 1.0 using gl.clearDepth and gl.clear
		gl.clearDepth(1.0);

		gl.clear(gl.DEPTH_BUFFER_BIT);
		
        // * "Use" the program R.progCopy.prog
		gl.useProgram(R.progCopy.prog);

        //var m = state.cameraMat.elements;
        // * Upload the camera matrix m to the uniform R.progCopy.u_cameraMat
        //   using gl.uniformMatrix4fv
		gl.uniformMatrix4fv(R.progCopy.u_cameraMat, gl.FALSE, state.cameraMat.elements);
		
        // * Draw the scene
        drawScene(state);
    };

    var drawScene = function(state) {
        for (var i = 0; i < state.models.length; i++) {
            var m = state.models[i];

            // If you want to render one model many times, note:
            // readyModelForDraw only needs to be called once.
            readyModelForDraw(R.progCopy, m);

            drawReadyModel(m);
        }
    };

    R.pass_debug.render = function(state) {
        // * Unbind any framebuffer, so we can write to the screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // * Bind/setup the debug "lighting" pass
        // * Tell shader which debug view to use
        bindTexturesForLightPass(R.prog_Debug);
        gl.uniform1i(R.prog_Debug.u_debug, cfg.debugView);

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.prog_Debug);
    };

    /**
     * 'deferred' pass: Add lighting results for each individual light
     */
    R.pass_deferred.render = function(state) {
        // * Bind R.pass_deferred.fbo to write into for later postprocessing
        gl.bindFramebuffer(gl.FRAMEBUFFER, R.pass_deferred.fbo);

        // * Clear depth to 1.0 and color to black
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // * _ADD_ together the result of each lighting pass

        // Enable blending and use gl.blendFunc to blend with:
        //   color = 1 * src_color + 1 * dst_color
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);

        // * Bind/setup the ambient pass, and render using fullscreen quad
        bindTexturesForLightPass(R.prog_Ambient);
        renderFullScreenQuad(R.prog_Ambient);

        // * Bind/setup the Blinn-Phong pass, and render using fullscreen quad
        bindTexturesForLightPass(R.prog_BlinnPhong_PointLight);

        // TODO: add a loop here, over the values in R.lights, which sets the
        //   uniforms R.prog_BlinnPhong_PointLight.u_lightPos/Col/Rad etc.,
        //   then does renderFullScreenQuad(R.prog_BlinnPhong_PointLight).
		

	    for (var i = 0; i < R.NUM_LIGHTS; i++) 
		{
			var l = R.lights[i];
			
			if (cfg.debug)
			{
				if(cfg.primitive == 0)
				{
					// debugger;
					gl.enable(gl.SCISSOR_TEST);
					var scissor = getScissorForLight(state.viewMat, state.projMat, l);
					if(scissor!=null)
					{
						gl.scissor(scissor[0],scissor[1],scissor[2],scissor[3]);
						renderFullScreenQuad(R.progRed);
					}
					gl.disable(gl.SCISSOR_TEST);
				}

				else if(cfg.primitive == 1)
				{
				    var translationMatrix = new THREE.Matrix4().makeTranslation(l.pos[0], l.pos[1], l.pos[2]);
				    var scaleMatrix = new THREE.Matrix4().makeScale(l.rad, l.rad, l.rad);
					var modelMatrix = new THREE.Matrix4().multiplyMatrices(translationMatrix, scaleMatrix);

					// debugger;
					
					readyModelForDraw(R.progSphere, R.sphereModel);
					gl.uniformMatrix4fv(R.progSphere.u_cameraMatrix, false, state.cameraMat.elements);
					gl.uniform3fv(R.progSphere.u_pos, l.pos);
					gl.uniform1f(R.progSphere.u_scale, l.rad);
					
					drawReadyModel(R.sphereModel);
				}
			}

	
			else
			{
				var mode;
				if(cfg.toon)
				{
					mode = 1.0;
				}
				
				else if(cfg.bloom)
				{
					mode = 2.0;
				}
				
				else
				{
					mode = 0.0;
				}
				
				if(cfg.primitive == 0)
				{
					gl.enable(gl.SCISSOR_TEST);
					var scissor = getScissorForLight(state.viewMat, state.projMat, l);
					if(scissor!=null)
					{
						console.log(scissor);
						gl.scissor(scissor[0],scissor[1],scissor[2],scissor[3]);
						
						gl.uniform3fv(R.prog_BlinnPhong_PointLight.u_lightPos, l.pos);
						gl.uniform3fv(R.prog_BlinnPhong_PointLight.u_lightCol, l.col);
						gl.uniform1f(R.prog_BlinnPhong_PointLight.u_lightRad, l.rad);
						gl.uniform1f(R.prog_BlinnPhong_PointLight.u_mode, mode);
				
						gl.uniform3f(R.prog_BlinnPhong_PointLight.u_camPos, state.cameraPos.x, state.cameraPos.y, state.cameraPos.z);
						renderFullScreenQuad(R.prog_BlinnPhong_PointLight);
					}
					gl.disable(gl.SCISSOR_TEST);
				}
				
				else if(cfg.primitive == 1)
				{
					gl.uniform3fv(R.prog_BlinnPhong_PointLight.u_lightPos, l.pos);
					gl.uniform3fv(R.prog_BlinnPhong_PointLight.u_lightCol, l.col);
					gl.uniform1f(R.prog_BlinnPhong_PointLight.u_lightRad, l.rad);
					gl.uniform1f(R.prog_BlinnPhong_PointLight.u_mode, mode);
			
					gl.uniform3f(R.prog_BlinnPhong_PointLight.u_camPos, state.cameraPos.x, state.cameraPos.y, state.cameraPos.z);
					renderFullScreenQuad(R.prog_BlinnPhong_PointLight);
				}
				
				else
				{
					gl.uniform3fv(R.prog_BlinnPhong_PointLight.u_lightPos, l.pos);
					gl.uniform3fv(R.prog_BlinnPhong_PointLight.u_lightCol, l.col);
					gl.uniform1f(R.prog_BlinnPhong_PointLight.u_lightRad, l.rad);
					gl.uniform1f(R.prog_BlinnPhong_PointLight.u_mode, mode);
			
					gl.uniform3f(R.prog_BlinnPhong_PointLight.u_camPos, state.cameraPos.x, state.cameraPos.y, state.cameraPos.z);
					renderFullScreenQuad(R.prog_BlinnPhong_PointLight);
				}
			}
		}
			

//
		// TODO: In the lighting loop, use the scissor test optimization
        // Enable gl.SCISSOR_TEST, render all lights, then disable it.
        //
        // getScissorForLight returns null if the scissor is off the screen.
        // Otherwise, it returns an array [xmin, ymin, width, height].
        //
          //var sc = getScissorForLight(state.viewMat, state.projMat, light);

        // Disable blending so that it doesn't affect other code
        gl.disable(gl.BLEND);
    };

    var bindTexturesForLightPass = function(prog) {
        gl.useProgram(prog.prog);

        // * Bind all of the g-buffers and depth buffer as texture uniform
        //   inputs to the shader
        for (var i = 0; i < R.NUM_GBUFFERS; i++) {
            gl.activeTexture(gl['TEXTURE' + i]);
            gl.bindTexture(gl.TEXTURE_2D, R.pass_copy.gbufs[i]);
            gl.uniform1i(prog.u_gbufs[i], i);
        }
        gl.activeTexture(gl['TEXTURE' + R.NUM_GBUFFERS]);
        gl.bindTexture(gl.TEXTURE_2D, R.pass_copy.depthTex);
        gl.uniform1i(prog.u_depth, R.NUM_GBUFFERS);
    };

    /**
     * 'post1' pass: Perform (first) pass of post-processing
     */
    R.pass_post1.render = function(state) {
        // * Unbind any existing framebuffer (if there are no more passes)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // * Clear the framebuffer depth to 1.0
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // * Bind the postprocessing shader program
        gl.useProgram(R.progPost1.prog);

        // * Bind the deferred pass's color output as a texture input
        // Set gl.TEXTURE0 as the gl.activeTexture unit
		gl.activeTexture(gl.TEXTURE0);
		
        // Bind the TEXTURE_2D, R.pass_deferred.colorTex to the active texture unit
		gl.bindTexture(gl.TEXTURE_2D, R.pass_deferred.colorTex);
        // Configure the R.progPost1.u_color uniform to point at texture unit 0
        gl.uniform1i(R.progPost1.u_color, 0);

        // * Render a fullscreen quad to perform shading on
        renderFullScreenQuad(R.progPost1);
    };

    var renderFullScreenQuad = (function() {
        // The variables in this function are private to the implementation of
        // renderFullScreenQuad. They work like static local variables in C++.

        // Create an array of floats, where each set of 3 is a vertex position.
        // You can render in normalized device coordinates (NDC) so that the
        // vertex shader doesn't have to do any transformation; draw two
        // triangles which cover the screen over x = -1..1 and y = -1..1.
        // This array is set up to use gl.drawArrays with gl.TRIANGLE_STRIP.
        var positions = new Float32Array([
            -1.0, -1.0, 0.0,
             1.0, -1.0, 0.0,
            -1.0,  1.0, 0.0,
             1.0,  1.0, 0.0
        ]);

        var vbo = null;

        var init = function() {
            // Create a new buffer with gl.createBuffer, and save it as vbo.
            vbo  = gl.createBuffer()

            // Bind the VBO as the gl.ARRAY_BUFFER
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
			
            // Upload the positions array to the currently-bound array buffer
            // using gl.bufferData in static draw mode.
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        };

        return function(prog) {
            if (!vbo) {
                // If the vbo hasn't been initialized, initialize it.
                init();
            }

            // Bind the program to use to draw the quad
            gl.useProgram(prog.prog);

            // Bind the VBO as the gl.ARRAY_BUFFER
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
			            
            // Enable the bound buffer as the vertex attrib array for
            // prog.a_position, using gl.enableVertexAttribArray
            gl.enableVertexAttribArray(prog.a_position);
			
            // Use gl.vertexAttribPointer to tell WebGL the type/layout for
            // prog.a_position's access pattern.
			gl.vertexAttribPointer(prog.a_position, 3, gl.FLOAT, gl.FALSE, 0, 0);

			// Use gl.drawArrays (or gl.drawElements) to draw your quad.
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Unbind the array buffer.
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        };
    })();
	
})();
