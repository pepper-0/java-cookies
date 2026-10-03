from __future__ import annotations

from training.contract import TrainingConfig


BACKBONE_NAME = "mobilenetv3_small_backbone"


def build_model(config: TrainingConfig, number_of_classes: int, weights="imagenet"):
    import tensorflow as tf

    application = tf.keras.applications.MobileNetV3Small(
        input_shape=(*config.image_size, 3),
        alpha=1.0,
        minimalistic=False,
        include_top=False,
        weights=weights,
        pooling="avg",
        include_preprocessing=True,
    )
    backbone = tf.keras.Model(
        inputs=application.input,
        outputs=application.output,
        name=BACKBONE_NAME,
    )
    backbone.trainable = False

    inputs = tf.keras.Input(shape=(*config.image_size, 3), dtype=tf.float32, name="image")
    features = backbone(inputs, training=False)
    features = tf.keras.layers.Dropout(config.dropout_rate, name="classifier_dropout")(features)
    outputs = tf.keras.layers.Dense(
        number_of_classes,
        activation="softmax",
        name="probabilities",
    )(features)
    model = tf.keras.Model(inputs=inputs, outputs=outputs, name="limadrc_mobilenetv3_small")
    return model, backbone


def get_backbone(model):
    try:
        return model.get_layer(BACKBONE_NAME)
    except ValueError as error:
        raise ValueError(f"Model does not contain the expected {BACKBONE_NAME} layer.") from error


def enable_fine_tuning(backbone, number_of_layers: int) -> None:
    import tensorflow as tf

    backbone.trainable = True
    fine_tune_from = max(0, len(backbone.layers) - number_of_layers)
    for index, layer in enumerate(backbone.layers):
        layer.trainable = index >= fine_tune_from and not isinstance(
            layer, tf.keras.layers.BatchNormalization
        )


def compile_model(model, learning_rate: float) -> None:
    import tensorflow as tf

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=[
            tf.keras.metrics.SparseCategoricalAccuracy(name="accuracy"),
            tf.keras.metrics.SparseTopKCategoricalAccuracy(k=3, name="top_3_accuracy"),
        ],
    )
