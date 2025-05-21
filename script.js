// Função para forçar a animação das habilidades
function forceSkillsAnimation($container) {
    // Resetar todas as animações primeiro
    $container.find('.skill-name').removeClass('animate');
    $container.find('.progress-bar-background').removeClass('animate');
    $container.find('.progress-bar-foreground').css('width', '0');
    $container.find('.skill-percentage').removeClass('animate');
    
    // Primeiro animar os nomes
    $container.find('.skill-entry').each(function(index) {
        setTimeout(() => {
            $(this).find('.skill-name').addClass('animate');
        }, index * 300);
    });
    
    // Depois de todos os nomes, animar as barras
    setTimeout(() => {
        // Adicionar animação das barras
        $container.find('.progress-bar-background').addClass('animate');
        $container.find('.skill-percentage').addClass('animate');
        
        // Após a animação Matrix, preencher as barras
        setTimeout(() => {
            $container.find('.progress-bar-foreground').each(function() {
                const percentage = $(this).data('percentage');
                $(this).css('width', percentage);
            });
            App.triggerPulse();
        }, 1500);
    }, $container.find('.skill-entry').length * 300 + 500);
}

// Função para animar as habilidades
function animateSkills($container) {
    // Primeiro animar os nomes
    $container.find('.skill-entry').each(function(index) {
        setTimeout(() => {
            $(this).find('.skill-name').addClass('animate');
        }, index * 200);
    });

    // Depois animar as barras
    setTimeout(() => {
        $container.find('.progress-bar-background').addClass('animate');
        $container.find('.skill-percentage').addClass('animate');
        
        // Por fim, preencher as barras
        setTimeout(() => {
            $container.find('.progress-bar-foreground').each(function() {
                const percentage = $(this).data('percentage');
                $(this).css('--percentage', percentage);
                $(this).addClass('animate');
            });
        }, 500);
    }, $container.find('.skill-entry').length * 200 + 300);
}

// --- Funcionalidade Fullscreen para Frame de Habilidades ---
$('#skills-fullscreen').on('click', function() {
    const skillsContentModal = $('#skills-area').html(); 
    $('#skills-modal-content-area').html(skillsContentModal);
    $('#skills-modal').addClass('active');
    $('body').css('overflow', 'hidden');
});

// Minimizar Skills Frame
$('#minimize-skills').on('click', function() {
    $('#skills-frame').addClass('minimized');
    $('#skills-icon').fadeIn(300);
});

// Restaurar Skills Frame
$('#skills-icon').on('click', function() {
    $(this).fadeOut(200, function() {
        const $frame = $('#skills-frame');
        $frame.removeClass('minimized');
        
        // Animar ao restaurar
        setTimeout(() => {
            animateSkills($frame);
        }, 300);
    });
});

// Sincronizar estado ao fechar modal
$('#skills-modal-close, #skills-modal').on('click', function(e) {
    if (e.target.id === 'skills-modal-close' || e.target.id === 'skills-modal') {
        $('#skills-modal').removeClass('active');
        $('body').css('overflow', 'auto');
        $('#skills-modal-content-area').empty();
    }
});

// Controle do efeito de energia digital
document.addEventListener('DOMContentLoaded', () => {
    const digitalEnergy = document.querySelector('.digital-energy');
    
    // Atualiza a posição do gradiente radial baseado no movimento do mouse
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        digitalEnergy.style.setProperty('--x', `${x}%`);
        digitalEnergy.style.setProperty('--y', `${y}%`);
    });
}); 