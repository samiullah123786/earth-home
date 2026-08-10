"""Hand-placed pixel part grids - the one-time bakery for PNG assets.

Each grid bakes to a transparent, pre-positioned PNG under assets/, after
which composition is pure PNG layer stacking (see compose.py). When the
Renderfull AI API is wired in, any baked PNG can be replaced 1:1 without
touching this file or the compositor. Widths are assert-guarded.
"""

# ------------------------------------------------------------------- head
HEAD_FACE = [
    "........OOOOOOOOOOOO........",
    "......OOSSSSSSSSSSSSOO......",
    ".....OSSSSSSSSSSSSSSSSO.....",
    "....OSSSSSSSSSSSSSSSSSSO....",
    "...OSSSSSSSSSSSSSSSSSSSSO...",
    "...OSSSSSSSSSSSSSSSSSSSSO...",
    "...OSSSSSSSSSSSSSSSSSSSSO...",
    "...OSSSSSSSSSSSSSSSSSSSSO...",
    "...OSSEEeSSSSSSSSSSEEeSSO...",
    "...OSSEEESSSSSSSSSSEEESSO...",
    "...OSSEEESSSSSSSSSSEEESSO...",
    "...OSBBSSSSSSSSSSSSSSBBSO...",
    "...OSSSSSSSOSSSSOSSSSSSSO...",
    "...OSSSSSSSSOOOOSSSSSSSSO...",
    "....OsSSSSSSSSSSSSSSSSsO....",
    ".....OssSSSSSSSSSSSSssO.....",
    "......OOssssssssssssOO......",
    "........OOOOOOOOOOOO........",
]

# ------------------------------------------------------------------- hair
HAIR_BROWN_WAVY = [
    "........OOOOOOOOOOOO........",
    "......OOHHHHHHHHHHHHOO......",
    ".....OHHHHhhHHHHhhHHHHO.....",
    "....OHHHHHHHHHHHHHHHHHHO....",
    "...OHHHHHHHHHHHHHHHHHHHHO...",
    "...OH..HH....HH....HH..HO...",
    "...OH..................HO...",
    "...OH..................HO...",
]

HAIR_SIDEBURNS = [
    "...OHH................HHO...",
    "...OH..................HO...",
    "...OH..................HO...",
]

HAIR_PURPLE_BOB = [
    "........OOOOOOOOOOOO........",
    "......OOVVVVVVVVVVVVOO......",
    ".....OVVVVvvVVVVvvVVVVO.....",
    "....OVVVVVVVVVVVVVVVVVVO....",
    "...OVVVVVVVVVVVVVVVVVVVVO...",
    "...OVVVV....VVVV....VVVVO...",
    "...OVV................VVO...",
    "...OVV................VVO...",
    "...OVV................VVO...",
    "...OVV................VVO...",
    "...OVV................VVO...",
    "...OVV................VVO...",
    "...OVV................VVO...",
]

# ------------------------------------------------------------------- hats
HAT_CROWN_GOLD = [
    ".....OO....OO....OO.....",
    "....OCCO..OCCO..OCCO....",
    "...OCCCCOOCCCCOOCCCCO...",
    "...OCCCCCCCCCCCCCCCCO...",
    "...OCgCCCCCggCCCCCgCO...",
    "...OccccccccccccccccO...",
]

HAT_OFFICER_CAP = [
    ".......OOOOOOOOOOOO.......",
    ".....OORRRRRRRRRRRROO.....",
    "....ORRRRRRRRRRRRRRRRO....",
    "...ORRRRRRRAAAARRRRRRRO...",
    "...ORRRRRRRAaaARRRRRRRO...",
    "..OOOOOOOOOOOOOOOOOOOOOO..",
    "....OOOOOOOOOOOOOOOOOO....",
]

HAT_GOGGLES = [
    "..OOOOOOOOOOOOOOOOOOOOOO..",
    ".OOLLLLLOOOOOOOOOOLLLLLOO.",
    ".OOLLLLLOOOOOOOOOOLLLLLOO.",
    "..OOOOOOOOOOOOOOOOOOOOOO..",
]

HAT_BARD_BERET = [
    ".................OCO........",
    "................OCCO........",
    "...............OCCO.........",
    ".....OOOOOOOOOOOCCOO........",
    "...OOVVVVVVVVVVVVVVVOO......",
    "..OVVVVVVVVVVVVVVVVVVVO.....",
    "..OVVvvVVVVVVVVVVvvVVVO.....",
    "...OOOOOOOOOOOOOOOOOOO......",
]

HAT_GRAD_CAP = [
    "...............OO..............",
    ".....OOOOOOOOOOOOOOOOOOOOOO....",
    "...OONNNNNNNNNNNNNNNNNNNNNNOO..",
    ".OONNNNNNNNNNNNNNNNNNNNNNNNNNOO",
    "...OOOOOOOOOOOOOOOOOOOOOOOOOO..",
    ".......ONNNNNNNNNNNNNNNO..C....",
    ".......OOOOOOOOOOOOOOOOO..C....",
]

# ---------------------------------------------------------------- bodies
# 24 wide x 15 tall: 10 torso rows + 5 leg rows, arms included.
BODY_AMBER_TUNIC = [
    "......OOOOOOOOOOOO......",
    ".....OTTTTTOOTTTTTO.....",
    "...OOTTTTTOCCOTTTTTOO...",
    "..OSTOTTTTOCCOTTTTOTSO..",
    "..OSSOTTTTTOOTTTTTOSSO..",
    "..OssOTTTTTTTTTTTTOssO..",
    "...OOtTTTTTTTTTTTTtOO...",
    ".....OtTTTTTTTTTTtO.....",
    ".....OttttttttttttO.....",
    ".....OOOOOOOOOOOOOO.....",
    ".....OPPPPO..OPPPPO.....",
    ".....OPPPPO..OPPPPO.....",
    "....ObbbbbO..ObbbbbO....",
    "....ObbbbbO..ObbbbbO....",
    "....OOOOOOO..OOOOOOO....",
]

BODY_OFFICER_RED = [
    "......OOOOOOOOOOOO......",
    ".....ORRRRROORRRRRO.....",
    "...OORRRRROAAORRRRROO...",
    "..OSRORRRROAAORRRRORSO..",
    "..OSSORRRRROORRRRROSSO..",
    "..OssORRRRRRRRRRRROssO..",
    "...OOrRRRRRRRRRRRRrOO...",
    ".....OrRRRRRRRRRRrO.....",
    ".....OrrrrrrrrrrrrO.....",
    ".....OOOOOOOOOOOOOO.....",
    ".....OrrrrO..OrrrrO.....",
    ".....OrrrrO..OrrrrO.....",
    "....OFFFFFO..OFFFFFO....",
    "....OFFFFFO..OFFFFFO....",
    "....OOOOOOO..OOOOOOO....",
]

BODY_ENGINEER_VEST = [
    "......OOOOOOOOOOOO......",
    ".....OWWKKKKKKKKWWO.....",
    "...OOWKKKKKKKKKKKKWOO...",
    "..OSWOKKKKKKKKKKKKOWSO..",
    "..OSSOKKKKKKKKKKKKOSSO..",
    "..OssOKKKkKKKKkKKKOssO..",
    "...OOkKKKKKKKKKKKKkOO...",
    ".....OkKKKKKKKKKKkO.....",
    ".....OkkkkkkkkkkkkO.....",
    ".....OOOOOOOOOOOOOO.....",
    ".....OkkkkO..OkkkkO.....",
    ".....OkkkkO..OkkkkO.....",
    "....ObbbbbO..ObbbbbO....",
    "....ObbbbbO..ObbbbbO....",
    "....OOOOOOO..OOOOOOO....",
]

BODY_BARD_VEST = [
    "......OOOOOOOOOOOO......",
    ".....OWWVVVVVVVVWWO.....",
    "...OOWVVVVVVVVVVVVWOO...",
    "..OSWOVVVVVVVVVVVVOWSO..",
    "..OSSOVVVVVVVVVVVVOSSO..",
    "..OssOVVVvVVVVvVVVOssO..",
    "...OOvVVVVVVVVVVVVvOO...",
    ".....OvVVVVVVVVVVvO.....",
    ".....OvvvvvvvvvvvvO.....",
    ".....OOOOOOOOOOOOOO.....",
    ".....OvvvvO..OvvvvO.....",
    ".....OvvvvO..OvvvvO.....",
    "....ObbbbbO..ObbbbbO....",
    "....ObbbbbO..ObbbbbO....",
    "....OOOOOOO..OOOOOOO....",
]

BODY_SCHOLAR_ROBE = [
    "......OOOOOOOOOOOO......",
    ".....ONNNNNNNNNNNNO.....",
    "...OONNNNNNNNNNNNNNOO...",
    "..OSNONNNNNNNNNNNNONSO..",
    "..OSSONNNNNNNNNNNNOSSO..",
    "..OssONNnNNNNNNnNNOssO..",
    "...OONNNNNNNNNNNNNNOO...",
    "....ONNNNNNNNNNNNNNO....",
    "...ONNNNNNNNNNNNNNNNO...",
    "...ONNNNNNNNNNNNNNNNO...",
    "...ONNNNNNNNNNNNNNNNO...",
    "...ONNNNNNNNNNNNNNNNO...",
    "...OnnnnnnnnnnnnnnnnO...",
    ".....ObbbbOOOObbbbO.....",
    ".....OOOOOO..OOOOOO.....",
]

BODY_CITIZEN_BLUE = [
    "......OOOOOOOOOOOO......",
    ".....ODDDDDDDDDDDDO.....",
    "...OODDDDDDDDDDDDDDOO...",
    "..OSDODDDDDDDDDDDDODSO..",
    "..OSSODDDDDDDDDDDDOSSO..",
    "..OssODDDDDDDDDDDDOssO..",
    "...OObbbbbbbbbbbbbbOO...",
    ".....ODDDDDDDDDDDDO.....",
    ".....ODDDDDDDDDDDDO.....",
    ".....OOOOOOOOOOOOOO.....",
    ".....ODDDDO..ODDDDO.....",
    ".....ODDDDO..ODDDDO.....",
    "....ObbbbbO..ObbbbbO....",
    "....ObbbbbO..ObbbbbO....",
    "....OOOOOOO..OOOOOOO....",
]

# ------------------------------------------------------------- accessories
ACC_SHIELD = [
    "..OOOOOOOO..",
    ".OAAAAAAAAO.",
    "OAAAAAAAAAAO",
    "OAAAAOOAAAAO",
    "OAAAAOOAAAAO",
    "OAAAAAAAAAAO",
    "OAAAAAAAAAAO",
    ".OAAAAAAAAO.",
    ".OaAAAAAAaO.",
    "..OaAAAAaO..",
    "...OaAAaO...",
    "....OaaO....",
    ".....OO.....",
]

GRIDS = {
    "heads/head_light_chibi": HEAD_FACE,
    "hair/hair_brown_wavy": HAIR_BROWN_WAVY,
    "hair/hair_sideburns": HAIR_SIDEBURNS,
    "hair/hair_purple_bob": HAIR_PURPLE_BOB,
    "hats/hat_crown_gold": HAT_CROWN_GOLD,
    "hats/hat_officer_cap": HAT_OFFICER_CAP,
    "hats/hat_goggles": HAT_GOGGLES,
    "hats/hat_bard_beret": HAT_BARD_BERET,
    "hats/hat_grad_cap": HAT_GRAD_CAP,
    "bodies/body_amber_tunic": BODY_AMBER_TUNIC,
    "bodies/body_officer_red": BODY_OFFICER_RED,
    "bodies/body_engineer_vest": BODY_ENGINEER_VEST,
    "bodies/body_bard_vest": BODY_BARD_VEST,
    "bodies/body_scholar_robe": BODY_SCHOLAR_ROBE,
    "bodies/body_citizen_blue": BODY_CITIZEN_BLUE,
    "accessories/acc_shield": ACC_SHIELD,
}

for name, rows in GRIDS.items():
    width = len(rows[0])
    for index, row in enumerate(rows):
        assert len(row) == width, f"{name} row {index} is {len(row)} wide, wanted {width}"
