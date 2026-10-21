<!DOCTYPE html>
<html>
    <head>
        <title>Stage 5. control</title>
        <meta charset="utf-8">
        <div id="char">^</div>
        <div id="bug">^</div>
        <div id="char_life">You</div>
        <div id="bug_life">Bug</div>
        <div id="title">Stage 5. control</div>

        <p><button class="motion" id="random" onclick="motion('random', 'char', 0); event_('random', 'bug', 1); const now = this; now.style.visibility = 'hidden'; setTimeout(function(){now.style.visibility = 'visible';}, 3000);">move to random position</button>
        <button class="motion" id="point" onclick="motion('point', 'char', 0); event_('point', 'bug', 1); const now = this; now.style.visibility = 'hidden'; setTimeout(function(){now.style.visibility = 'visible';}, 3000);">point towards character</button>
        <button class="motion" id="move1" onclick="motion('move1', 'char', 0); event_('move1', 'bug', 1);">move 10 steps</button>
        <button class="motion" id="move2" onclick="motion('move2', 'char', 0); event_('move2', 'bug', 1);">move -10 steps</button>
        <button class="motion" id="bounce" onclick="motion('bounce', 'char', 0); event_('bounce', 'bug', 1);">if on edge, bounce</button>
        <button class="motion" id="clock" onclick="motion('clock', 'char', 0); event_('clock', 'bug', 1);">turn ⟳ 45 degrees</button>
        <button class="motion" id="counter_clock" onclick="motion('counter_clock', 'char', 0); event_('counter_clock', 'bug', 1);">turn ⟲ 45 degrees</button></p>

        <p><button class="looks" id="size" onclick="looks('size', 'char', 0); event_('size', 'bug', 1); const now = this; now.style.visibility = 'hidden'; setTimeout(function(){now.style.visibility = 'visible';}, 3000);">set size to 50%</button>
        <button class="looks" id="hide" onclick="looks('hide', 'char', 0); event_('hide', 'bug', 1); const now = this; now.style.visibility = 'hidden'; setTimeout(function(){now.style.visibility = 'visible';}, 3000);">hide</button></p>

        <p><button class="sound" id="sound" onclick="sound('sound', 'char', 0); event_('sound', 'bug', 1); const now = this; now.style.visibility = 'hidden'; setTimeout(function(){now.style.visibility = 'visible';}, 3000);">start sound</button>
        <button class="sound" id="mute" onclick="sound('mute', 'char', 0); event_('mute', 'bug', 1); const now = this; now.style.visibility = 'hidden'; setTimeout(function(){now.style.visibility = 'visible';}, 15000);">stop all sounds</button></p>

        <div id="bug_code">Bug Code</div>
        <form action="stage6.html" method="POST">
            <input type="hidden" id="id" name="id" value="1">
            <button type="submit" id="nextlevel">next stage</button>
        </form>
        <button id="restart" onclick="restart()">restart</button>
        <a href="games.html" id="exit">exit</a>
    </head>
    <body>
        <style>
        *{
            box-sizing: border-box;
            overflow: hidden;
        }
        body{
            background-color: rgb(255, 208, 127);
        }
        #char{
            width: 10%;
            height: 10%;
            border-radius: 50%;
            border: 2px solid black;
            background-color: rgb(122, 122, 122);
            color: white;
            font-size: 5rem;
            text-align: center;
            position: absolute;
            left: 20%;
            top: 45%;
        }
        #bug{
            width: 10%;
            height: 10%;
            border-radius: 50%;
            border: 2px solid black;
            background-color: rgb(255, 160, 0);
            color: white;
            font-size: 5rem;
            text-align: center;
            position: absolute;
            left: 70%;
            top: 45%;
        }
        #char_life{
            width: 20%;
            height: 2%;
            background-color: rgb(0, 255, 0);
            color: black;
            text-align: left;
            position: absolute;
            left: 10%;
            top: 5%;
        }
        #bug_life{
            width: 20%;
            height: 2%;
            background-color: rgb(255, 0, 0);
            color: white;
            text-align: right;
            position: absolute;
            right: 10%;
            top: 5%;
        }
        #title{
            text-align: center;
            font-size: 3rem;
            color: orange;
        }
        .motion{
            background-color: rgb(0, 110, 255);
            border: none;
            color: white;
            display: block;
        }
        .looks{
            background-color: rgb(140, 0, 255);
            border: none;
            color: white;
            display: block;
        }
        .sound{
            background-color: rgb(210, 0, 255);
            border: none;
            color: white;
            display: block;
        }
        #bug_code{
            text-align: right;
            font-size: 2rem;
        }
        #restart{
            font-size: 30px;
            color: white;
            background-color: rgb(125, 0, 125);
            border: none;
            text-decoration: none;
            display: none;
            position: absolute;
            left: 83%;
            top: 95%;
        }
        #nextlevel{
            font-size: 30px;
            color: rgb(0, 0, 0);
            background-color: rgb(255, 122, 0);
            border: none;
            text-decoration: none;
            display: none;
            position: absolute;
            left: 77%;
            top: 95%;
        }
        #exit{
            font-size: 30px;
            color: rgb(0, 0, 0);
            background-color: rgb(0, 255, 0);
            border: none;
            text-decoration: none;
            display: none;
            position: absolute;
            left: 94%;
            top: 95%;
        }
        </style>
        <script>
        var x = {char: -25, bug: 25}, y = {char: 0, bug: 0}, dir = {char: 90, bug: -90}, life = {char: 10, bug: 10}, isgame = 1, count = 0, signal1 = 0;
        window.addEventListener("keydown", function(){move(event); attack_func();});
        document.getElementById("char").style.display = "block";
        document.getElementById("bug").style.display = "block";
         
        function convert(x){
            return Number(x.slice(0, x.length - 1));
        }

        function bug_code(str, type){
            var message = document.createElement("DIV");
            document.body.appendChild(message);
            message.style.textAlign = "right";
            message.innerHTML = str;
            if(type == "motion"){
                message.style.color = "rgb(0, 110, 255)";
            } else if(type == "looks"){
                message.style.color = "rgb(140, 0, 255)";
            } else if(type == "sound"){
                message.style.color = "rgb(190, 0, 255)";
            } else if(type == "event"){
                message.style.color = "rgb(255, 200, 0)";
            } else if(type == "control"){
                message.style.color = "rgb(255, 160, 0)";
            }
            setTimeout(function(){message.remove();}, 1500);
        }

        function move(event){
            if(event.keyCode == 37){
                dir['char'] -= 10;
            } else if(event.keyCode == 38){
                x['char'] += Math.sin(dir['char']/180*Math.PI);
                y['char'] += Math.cos(dir['char']/180*Math.PI);
            } else if(event.keyCode == 39){
                dir['char'] += 10;
            } else if(event.keyCode == 40){
                x['char'] -= Math.sin(dir['char']/180*Math.PI);
                y['char'] -= Math.cos(dir['char']/180*Math.PI);
            };
            remove();
        };

        function attack_func(){
            if(event.keyCode == 32){
                event_("attack", "bug", 1);
                var attack = document.createElement("DIV");
                document.body.appendChild(attack);
                attack.style.width = 2 + "%";
                attack.style.height = 2 + "%";
                attack.style.backgroundColor = "rgb(0, 255, 0)";
                attack.style.borderRadius = 50 + "%";
                attack.style.position = "absolute";
                attack.style.left = x['char'] + 49 + "%";
                attack.style.top = 49 - y['char'] + "%";
                const attack_x = Math.sin(dir['char']/180*Math.PI);
                const attack_y = Math.cos(dir['char']/180*Math.PI);
                var attack_move = setInterval(function(){
                    attack.style.left = convert(attack.style.left) + attack_x + "%";
                    attack.style.top = convert(attack.style.top) - attack_y + "%";
                    if(Math.sqrt(Math.pow(convert(attack.style.left) + 1 - (x['bug'] + 50), 2) + Math.pow(convert(attack.style.top) + 1 - (50 - y['bug']), 2)) <= 6 && document.getElementById("bug").style.display == "block" && isgame == 1){
                        life['bug']--;
                        document.getElementById("bug_life").style.width = 20*life['bug']/10 + "%";
                        motion("random", "bug", 1);
                        motion("point", "bug", 1);
                        looks("hide", "bug", 1);
                        attack.remove();
                        gameover();
                        clearInterval(attack_move);
                    }
                    if(convert(attack.style.left) <= -2 || convert(attack.style.left) >= 100 || convert(attack.style.top) <= -2 || convert(attack.style.top) >= 100){
                        attack.remove();
                        clearInterval(attack_move);
                    }
                }, 25);
            }
        }

        function motion(input, div, code){
            if(input == "random"){
                x[div] = 50*(2*Math.random() - 1);
                y[div] = 50*(2*Math.random() - 1);
                if(div == "bug" && code) bug_code("move to random position", "motion");
            } else if(input == "point"){
                if(div == "char"){
                    dir[div] = (Math.atan((x['char'] - x['bug'])/(y['char'] - y['bug']))/Math.PI + (Math.abs(y['bug'] - y['char'])/(y['char'] - y['bug']) + 1)/2)*180;
                } else if(div == "bug"){
                    dir[div] = (Math.atan((x['char'] - x['bug'])/(y['char'] - y['bug']))/Math.PI + (Math.abs(y['bug'] - y['char'])/(y['bug'] - y['char']) + 1)/2)*180;
                }
                if(div == "bug" && code) bug_code("point towards character", "motion");
            } else if(input == "move1"){
                x[div] += 10*Math.sin(dir[div]/180*Math.PI);
                y[div] += 10*Math.cos(dir[div]/180*Math.PI);
                if(div == "bug" && code) bug_code("move 10 steps", "motion");
            } else if(input == "move2"){
                x[div] -= 10*Math.sin(dir[div]/180*Math.PI);
                y[div] -= 10*Math.cos(dir[div]/180*Math.PI);
                if(div == "bug" && code) bug_code("move -10 steps", "motion");//
            } else if(input == "bounce"){
                if(x[div] < -45){
                    x[div] = -45;
                }
                if(x[div] > 45){
                    x[div] = 45;
                }
                if(y[div] < -45){
                    y[div] = -45;
                }
                if(y[div] > 45){
                    y[div] = 45;
                }
                if(div == "bug" && code) bug_code("if on edge, bounce", "motion");
            } else if(input == "clock"){
                dir[div] += 45;
                if(div == "bug" && code) bug_code("turn ⟳ 90 degrees", "motion");
            } else if(input == "counter_clock"){
                dir[div] -= 45;
                if(div == "bug" && code) bug_code("turn ⟲ 90 degrees", "motion");
            }
            remove();
        }

        function looks(input, div, code){
            if(input == "size"){
                document.getElementById(div).style.width = 5 + "%";
                document.getElementById(div).style.height = 5 + "%";
                document.getElementById(div).style.fontSize = 2.5 + "rem";
                if(code) bug_code("set size to 50%", "looks");
                setTimeout(function(){
                    document.getElementById(div).style.width = 10 + "%";
                    document.getElementById(div).style.height = 10 + "%";
                    document.getElementById(div).style.fontSize = 5 + "rem";
                    bug_code("set size to 100%", "looks");
                }, 1000);
            } else if(input == "hide"){
                document.getElementById(div).style.display = "none";
                if(code) bug_code("hide", "looks");
                setTimeout(function(){
                    document.getElementById(div).style.display = "block";
                    if(code) bug_code("show", "looks");
                }, 1000);
            }
        }

        function sound(input, div, code){
            if(input == "sound"){
                if(div == "char"){
                    var char_sound = document.createElement("DIV");
                    document.body.appendChild(char_sound);
                    char_sound.style.width = 2 + "%";
                    char_sound.style.height = 2 + "%";
                    char_sound.style.border = "2px solid gray";
                    char_sound.style.borderRadius = "50%";
                    char_sound.style.position = "absolute";
                    char_sound.style.left = x[div] + 49 + "%";
                    char_sound.style.top = 49 - y[div] + "%";
                    var char_sound_move = setInterval(function(){
                        char_sound.style.width = convert(char_sound.style.width) + 2 + "%";
                        char_sound.style.height = convert(char_sound.style.height) + 2 + "%";
                        char_sound.style.left = convert(char_sound.style.left) - 1 + "%";
                        char_sound.style.top = convert(char_sound.style.top) - 1 + "%";
                        if(Math.sqrt(Math.pow(convert(char_sound.style.left) + convert(char_sound.style.width)/2 - (x['char'] + 50), 2) + Math.pow(convert(char_sound.style.top) + convert(char_sound.style.height)/2 - (50 - y['char']), 2)) <= convert(char_sound.style.width)/2 + 5 && document.getElementById("bug").style.display == "block" && isgame == 1){
                            life['bug']--;
                            document.getElementById("char_life").style.width = 20*life['bug']/10 + "%";
                            motion("random", "bug", 1);
                            motion("point", "bug", 1);
                            looks("hide", "bug", 1);
                            char_sound.remove();
                            gameover();
                            clearInterval(char_sound_move);
                        } else if(signal1 == 1 && isgame == 1){
                            char_sound.remove();
                            clearInterval(char_sound_move);
                        }
                    }, 25);
                } else if(div == "bug"){
                    var bug_sound = document.createElement("DIV");
                    document.body.appendChild(bug_sound);
                    bug_sound.style.width = 2 + "%";
                    bug_sound.style.height = 2 + "%";
                    bug_sound.style.border = "2px solid gray";
                    bug_sound.style.borderRadius = "50%";
                    bug_sound.style.position = "absolute";
                    bug_sound.style.left = x[div] + 49 + "%";
                    bug_sound.style.top = 49 - y[div] + "%";
                    if(code) bug_code("start sound", "sound");
                    var bug_sound_move = setInterval(function(){
                        bug_sound.style.width = convert(bug_sound.style.width) + 2 + "%";
                        bug_sound.style.height = convert(bug_sound.style.height) + 2 + "%";
                        bug_sound.style.left = convert(bug_sound.style.left) - 1 + "%";
                        bug_sound.style.top = convert(bug_sound.style.top) - 1 + "%";
                        if(Math.sqrt(Math.pow(convert(bug_sound.style.left) + convert(bug_sound.style.width)/2 - (x['char'] + 50), 2) + Math.pow(convert(bug_sound.style.top) + convert(bug_sound.style.height)/2 - (50 - y['char']), 2)) <= convert(bug_sound.style.width)/2 + 5 && document.getElementById("char").style.display == "block" && isgame == 1){
                            life['char']--;
                            document.getElementById("char_life").style.width = 20*life['char']/10 + "%";
                            bug_code("when attack succesed", "event");
                            motion("clock", "bug", 0);
                            bug_code("turn 90 degrees <<<", "motion");
                            motion("move2", "bug", 0);
                            bug_code("move -10 steps <<<", "motion");
                            motion("bounce", "bug", 0);
                            bug_code("if on edge, bounce", "motion");
                            looks("size", "bug", 0);
                            bug_code("set size to 50%", "looks");
                            bug_sound.remove();
                            gameover();
                            clearInterval(bug_sound_move);
                        } else if(signal1 == 1 && isgame == 1){
                            bug_sound.remove();
                            clearInterval(bug_sound_move);
                        }
                    }, 25);
                }
            } else if(input == "mute"){
                signal1 = 1;
                setTimeout(function(){signal1 = 0;}, 25);
            }
        }

        function event_(input, div, code){
            if(input == "attack"){
                if(code) bug_code("when space key pressed", "event");
                motion("move2", "bug", 0);
                if(code) bug_code("move -10 steps <<<", "motion");
                motion("bounce", "bug", 0);
                if(code) bug_code("if on edge, bounce <<<", "motion");
            } else if(input == "random"){
                if(code) bug_code("when move to random position clicked", "event");
                motion("move2", "bug", 0);
                if(code) bug_code("move -10 steps <<<", "motion");
                motion("bounce", "bug", 0);
                if(code) bug_code("if on edge, bounce <<<", "motion");
            } else if(input == "point"){
                if(code) bug_code("when point towards character clicked", "event");
                motion("move2", "bug", 0);
                if(code) bug_code("move -10 steps <<<", "motion");
                motion("bounce", "bug", 0);
                if(code) bug_code("if on edge, bounce <<<", "motion");
            } else if(input == "move1"){
                if(code) bug_code("when move 10 steps clicked", "event");
            } else if(input == "move2"){
                if(code) bug_code("when move -10 steps clicked", "event");
            } else if(input == "bounce"){
                if(code) bug_code("when if on edge, bounce clicked", "event");
            } else if(input == "clock"){
                if(code) bug_code("when turn ⟳ 45 degrees clicked", "event");
            } else if(input == "counter_clock"){
                if(code) bug_code("when turn ⟲ 90 degrees clicked", "event");
            } else if(input == "size"){
                if(code) bug_code("when set size to 50% clicked", "event");
            } else if(input == "hide"){
                if(code) bug_code("when hide clicked", "event");
                motion("move2", "bug", 0);
                if(code) bug_code("move -10 steps <<<", "motion");
                motion("bounce", "bug", 0);
                if(code) bug_code("if on edge, bounce <<<", "motion");
            } else if(input == "sound"){
                if(code) bug_code("when start sound clicked", "event");
                motion("move2", "bug", 0);
                if(code) bug_code("move -10 steps <<<", "motion");
                motion("bounce", "bug", 0);
                if(code) bug_code("if on edge, bounce <<<", "motion");
            } else if(input == "mute"){
                if(code) bug_code("when stop all sounds clicked", "event");
            }
        }

        function control(input, div, code){
            if(input == "clone"){
                var clone = document.getElementById("bug").cloneNode(true);
                document.body.appendChild(clone);
                clone.style.display = "block";
                clone.style.left = 100*Math.random() - 1 + "%";
                clone.style.top = 100*Math.random() - 1 + "%";
                const clone_x = convert(clone.style.left) - 45, clone_y = 45 - convert(clone.style.top);
                clone.style.transform = "rotate(" + (Math.atan((x['char'] - clone_x)/(y['char'] - clone_y))/Math.PI + (Math.abs(clone_y - y['char'])/(clone_y - y['char']) + 1)/2)*180 + "deg)";
                if(code) bug_code("create clone of myself", "control");
                if(code) bug_code("when I start as a clone", "control");
                const org_x = x['bug'], org_y = y['bug'];
                x['bug'] = clone_x, y['bug'] = clone_y;
                sound("sound", "bug", 1);
                x['bug'] = org_x, y['bug'] = org_y;
                setTimeout(function(){clone.remove(); if(code) bug_code("delete this clone", "control");}, 1500);
            }
        }

        function bug_attack_func(){
            if(1){
                var bug_attack = document.createElement("DIV");
                document.body.appendChild(bug_attack);
                bug_attack.style.width = 2 + "%";
                bug_attack.style.height = 2 + "%";
                bug_attack.style.backgroundColor = "rgb(255, 0, 0)";
                bug_attack.style.borderRadius = "50%";
                bug_attack.style.position = "absolute";
                bug_attack.style.left = x['bug'] + 49 + "%";
                bug_attack.style.top = 49 - y['bug'] + "%";
                const bug_attack_x = (x['char'] - x['bug'])/Math.sqrt(Math.pow(x['char'] - x['bug'], 2) + Math.pow(y['char'] - y['bug'], 2));
                const bug_attack_y = (y['char'] - y['bug'])/Math.sqrt(Math.pow(x['char'] - x['bug'], 2) + Math.pow(y['char'] - y['bug'], 2));
                var bug_attack_move = setInterval(function(){
                    bug_attack.style.left = convert(bug_attack.style.left) + bug_attack_x + "%";
                    bug_attack.style.top = convert(bug_attack.style.top) - bug_attack_y + "%";
                    if(Math.sqrt(Math.pow(convert(bug_attack.style.left) + 1 - (x['char'] + 50), 2) + Math.pow(convert(bug_attack.style.top) + 1 - (50 - y['char']), 2)) <= 6 && document.getElementById("char").style.display == "block" && isgame == 1){
                        life['char']--;
                        document.getElementById("char_life").style.width = 20*life['char']/10 + "%";
                        motion("move2", "bug", 1);
                        motion("bounce", "bug", 1);
                        looks("size", "bug", 1);
                        bug_attack.remove();
                        gameover();
                        clearInterval(bug_attack_move);
                    }
                    if(convert(bug_attack.style.left) <= -2 || convert(bug_attack.style.left) >= 100 || convert(bug_attack.style.top) <= -2 || convert(bug_attack.style.top) >= 100){
                        bug_attack.remove();
                        clearInterval(bug_attack_move);
                    }
                }, 25);
            }
        }
            
        function remove(){
            document.getElementById("char").style.left = x['char'] + 45 + "%";
            document.getElementById("char").style.top = 45 - y['char'] + "%";
            document.getElementById("char").style.transform = "rotate(" + dir['char'] + "deg)";
            document.getElementById("bug").style.left = x['bug'] + 45 + "%";
            document.getElementById("bug").style.top = 45 - y['bug'] + "%";
            document.getElementById("bug").style.transform = "rotate(" + dir['bug'] + "deg)";
        }

        function gameover(){
            if(life['char'] == 0){
                alert("YOU LOSE");
                clearInterval(game);
                clearInterval(repeat);
                isgame = 0;
                document.getElementById("restart").style.display = "inline";
                document.getElementById("exit").style.display = "inline";
            } else if(life['bug'] == 0){
                alert("YOU WIN");
                clearInterval(game);
                clearInterval(repeat);
                isgame = 0;
                document.getElementById("nextlevel").style.display = "inline";
                document.getElementById("exit").style.display = "inline";
            }
        }

        function character_start(){
            <?php
            $index = 0;
            $code = explode(" ", $_POST['code']);
            while($index < count($code)){
                if($code[$index] == "start"){
                    while(strrpos($code[$index], ";") != strlen($code[$index])-1){
                        echo("");
                    }
                } else if($code[$index] == "bug"){

                } else if($code[$index] == "attacked"){

                }
                $index++;
            }
            ?>
        }

        function bug(){
            motion("random", "bug", 1);
            motion("point", "bug", 1);
            motion("move1", "bug", 1);
            motion("bounce", "bug", 1);
            bug_attack_func();
            motion("move2", "bug", 1);
            motion("bounce", "bug", 1);
            looks("hide", "bug", 1);
            if(count%5 == 0){sound("sound", "bug", 1); control("clone", "bug", 1);}
            count++;
        }

        function bug_repeat(){
            motion("move1", "bug", 0);
            motion("bounce", "bug", 0);
            setTimeout(function(){
                motion("move2", "bug", 0);
                motion("bounce", "bug", 0);
            }, 300);
        }

        function bug_start(){
            remove();
            bug_code("forever", "control");
            bug_code("move 10 steps <<<", "motion");
            bug_code("if on edge, bounce <<<", "motion");
            bug_code("wait 0.3 seconds <<<", "control");
            bug_code("move -10 steps <<<", "motion");
            bug_code("if on edge, bounce <<<", "motion");
            bug_code("wait 0.3 seconds <<<", "control");
        }

        function restart(){
            x['char'] = -25, y['char'] = 0, dir['char'] = 90, life['char'] = 10, x['bug'] = 25, y['bug'] = 0, dir['bug'] = -90, life['bug'] = 10, isgame = 1;
            document.getElementById("restart").style.display = "none";
            document.getElementById("exit").style.display = "none";
            bug_start();
            var game = setInterval(function(){ bug();}, 3000);
            var repeat = setInterval(function(){ bug_repeat();}, 600);
        }

        bug_start();
        var game = setInterval(function(){ bug();}, 3000);
        var repeat = setInterval(function(){ bug_repeat();}, 600);
        </script>
    </body>
</html>